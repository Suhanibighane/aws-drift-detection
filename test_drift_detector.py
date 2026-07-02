import sys
import os
import json
from unittest.mock import MagicMock, patch

# Set mock environment variables before importing the handler
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
os.environ['AWS_ACCESS_KEY_ID'] = 'mock'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'mock'
os.environ['DYNAMODB_TABLE'] = 'DriftHistory'
os.environ['SNS_TOPIC_ARN'] = 'arn:aws:sns:us-east-1:123456789012:DriftAlertTopic'
os.environ['BEDROCK_MODEL_ID'] = 'meta.llama3-8b-instruct-v1:0'
os.environ['TARGET_STACK_NAME'] = 'MyProductionStack'

# Import the lambda handler inside the patch context below
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

def run_mock_test():
    print("--- STARTING LOCAL MOCK DRIFT DETECTION TEST ---")
    
    # 1. Mock CloudFormation Responses
    mock_cfn = MagicMock()
    mock_cfn.detect_stack_drift.return_value = {
        'StackDriftDetectionId': 'mock-drift-id-123'
    }
    mock_cfn.describe_stack_drift_detection_status.return_value = {
        'DetectionStatus': 'DETECTION_COMPLETE'
    }
    
    # Simulate a drift in a security group (SSH port opened to public)
    mock_cfn.describe_stack_resource_drifts.return_value = {
        'StackResourceDrifts': [
            {
                'ResourceType': 'AWS::EC2::SecurityGroup',
                'LogicalResourceId': 'WebServerSecurityGroup',
                'PhysicalResourceId': 'sg-0123456789abcdef0',
                'StackResourceDriftStatus': 'MODIFIED',
                'PropertyDifferences': [
                    {
                        'PropertyPath': '/SecurityGroupIngress/0',
                        'ExpectedValue': '{"IpProtocol": "tcp", "FromPort": 80, "ToPort": 80, "CidrIp": "192.168.1.0/24"}',
                        'ActualValue': '{"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, "CidrIp": "0.0.0.0/0"}',
                        'DifferenceType': 'ADD'
                    }
                ]
            }
        ]
    }

    # 2. Mock Bedrock Llama 3 Response
    mock_bedrock = MagicMock()
    # Simulated response payload from Llama 3 8B
    mock_response_body = MagicMock()
    mock_response_body.read.return_value = json.dumps({
        'generation': 'Security Group WebServerSecurityGroup (sg-0123456789abcdef0) was MODIFIED: Ingress rule added to allow public SSH traffic (Port 22) from anywhere (0.0.0.0/0) which creates a security exposure.'
    }).encode('utf-8')
    
    mock_bedrock.invoke_model.return_value = {
        'body': mock_response_body
    }

    # 3. Mock DynamoDB Table
    mock_ddb = MagicMock()
    mock_table = MagicMock()
    mock_ddb.Table.return_value = mock_table
    
    # 4. Mock SNS Topic
    mock_sns = MagicMock()

    # Patch boto3 client/resource calls
    with patch('boto3.client') as mock_client_factory, patch('boto3.resource') as mock_resource_factory:
        def side_effect(service_name, *args, **kwargs):
            if service_name == 'cloudformation':
                return mock_cfn
            elif service_name == 'bedrock-runtime':
                return mock_bedrock
            elif service_name == 'sns':
                return mock_sns
            return MagicMock()
            
        mock_client_factory.side_effect = side_effect
        mock_resource_factory.return_value = mock_ddb

        # Import the lambda handler within patch context
        from lambda_functions.drift_detector import lambda_handler

        # Invoke the handler
        test_event = {
            'stack_name': 'MyProductionStack',
            'check_type': 'MANUAL'
        }
        
        response = lambda_handler(test_event, None)
        
        # Output results
        print("\n--- TEST RESPONSE ---")
        print(f"Status Code: {response['statusCode']}")
        body = json.loads(response['body'])
        print(f"Body: {json.dumps(body, indent=2)}")
        
        # Verify Mocks
        print("\n--- VERIFICATIONS ---")
        assert mock_cfn.detect_stack_drift.called, "detect_stack_drift should be called"
        assert mock_cfn.describe_stack_drift_detection_status.called, "describe_stack_drift_detection_status should be called"
        assert mock_cfn.describe_stack_resource_drifts.called, "describe_stack_resource_drifts should be called"
        assert mock_bedrock.invoke_model.called, "Bedrock invoke_model should be called"
        assert mock_table.put_item.called, "DynamoDB Table.put_item should be called to save history"
        assert mock_sns.publish.called, "SNS alert should be published"
        
        print("[SUCCESS] Local mock test completed successfully! The Lambda function correctly processed drift and invoked Bedrock Llama 3.")

if __name__ == '__main__':
    run_mock_test()
