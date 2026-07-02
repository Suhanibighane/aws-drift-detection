import os
import json
import time
import boto3
from datetime import datetime

# Initialize AWS SDK Clients
cfn = boto3.client('cloudformation')
ddb = boto3.resource('dynamodb')
bedrock = boto3.client('bedrock-runtime')
sns = boto3.client('sns')

# Load environment variables
TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'DriftHistory')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN')
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'meta.llama3-8b-instruct-v1:0')
TARGET_STACK_NAME = os.environ.get('TARGET_STACK_NAME')

def lambda_handler(event, context):
    """
    Lambda entrypoint. Can be triggered by EventBridge (scheduled) or API Gateway (manual).
    """
    print("Received event:", json.dumps(event))
    
    # Determine target stack name (from env or event payload)
    stack_name = event.get('stack_name', TARGET_STACK_NAME)
    check_type = event.get('check_type', 'SCHEDULED') # 'SCHEDULED' or 'MANUAL'
    
    if not stack_name:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Target Stack Name not specified in environment or payload.'})
        }
        
    try:
        print(f"Starting drift detection for stack: {stack_name}")
        
        # 1. Trigger Drift Detection
        drift_trigger = cfn.detect_stack_drift(StackName=stack_name)
        detection_id = drift_trigger['StackDriftDetectionId']
        print(f"Drift detection initiated. ID: {detection_id}")
        
        # 2. Poll for completion
        status = 'DETECTION_IN_PROGRESS'
        max_attempts = 12
        attempt = 0
        
        while status == 'DETECTION_IN_PROGRESS' and attempt < max_attempts:
            attempt += 1
            time.sleep(5)
            status_check = cfn.describe_stack_drift_detection_status(
                StackDriftDetectionId=detection_id
            )
            status = status_check['DetectionStatus']
            print(f"Polling attempt {attempt}: Status = {status}")
            
            if status == 'DETECTION_FAILED':
                raise Exception(f"CloudFormation drift detection failed: {status_check.get('DetectionStatusReason')}")
        
        if status == 'DETECTION_IN_PROGRESS':
            raise Exception("Drift detection timed out after 60 seconds.")
            
        # 3. Retrieve Drift Results
        drift_results = cfn.describe_stack_resource_drifts(StackName=stack_name)
        resource_drifts = drift_results.get('StackResourceDrifts', [])
        
        # Filter only drifted resources
        drifted_resources = [
            r for r in resource_drifts 
            if r.get('StackResourceDriftStatus') in ['MODIFIED', 'DELETED']
        ]
        
        timestamp = datetime.utcnow().isoformat() + 'Z'
        
        if not drifted_resources:
            print("No drift detected. Stack is IN_SYNC.")
            save_drift_to_db(stack_name, timestamp, 'IN_SYNC', [], "No drift detected. Your infrastructure matches the CloudFormation template.", check_type)
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'status': 'IN_SYNC',
                    'message': 'No drift detected.'
                })
            }
            
        print(f"Drift detected in {len(drifted_resources)} resource(s). Processing AI summary...")
        
        # 4. Generate AI summaries for drifted resources
        summaries = []
        for resource in drifted_resources:
            summary = generate_ai_explanation(resource)
            summaries.append(summary)
            
        combined_summary = " | ".join(summaries)
        
        # 5. Save history to DynamoDB
        save_drift_to_db(stack_name, timestamp, 'DRIFTED', drifted_resources, combined_summary, check_type)
        
        # 6. Publish notification via SNS
        if SNS_TOPIC_ARN:
            send_sns_alert(stack_name, combined_summary, timestamp)
            
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'DRIFTED',
                'summary': combined_summary,
                'drifts': json.loads(json.dumps(drifted_resources, default=str))
            })
        }
        
    except Exception as e:
        print(f"Error executing drift check: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def generate_ai_explanation(drift_details):
    """
    Sends the raw drift JSON of a single resource to Amazon Bedrock (Meta Llama 3 8B)
    to translate the change into a single clear sentence.
    """
    resource_type = drift_details.get('ResourceType', 'Unknown Resource')
    logical_id = drift_details.get('LogicalResourceId', 'Unknown ID')
    physical_id = drift_details.get('PhysicalResourceId', 'Unknown Physical ID')
    drift_status = drift_details.get('StackResourceDriftStatus', 'MODIFIED')
    diffs = drift_details.get('PropertyDifferences', [])
    
    # Construct a simplified JSON payload to send to Bedrock to save tokens and improve quality
    payload_to_llm = {
        "ResourceType": resource_type,
        "LogicalResourceId": logical_id,
        "PhysicalResourceId": physical_id,
        "DriftStatus": drift_status,
        "PropertyDifferences": [
            {
                "PropertyPath": d.get('PropertyPath'),
                "ExpectedValue": d.get('ExpectedValue'),
                "ActualValue": d.get('ActualValue'),
                "DifferenceType": d.get('DifferenceType')
            }
            for d in diffs
        ]
    }
    
    system_prompt = (
        "You are an expert AWS Cloud Administrator. Translate the raw CloudFormation resource drift JSON "
        "into a single, clear, friendly plain-English sentence describing what changed and why it is important. "
        "Do not include any greeting, introduction, or additional text. Output ONLY the one sentence.\n\n"
        "Example output format:\n"
        "Security Group WebSecurityGroup (sg-0abc123) was MODIFIED: Ingress rule added to allow public SSH traffic (Port 22) from anywhere (0.0.0.0/0) which creates a security exposure."
    )
    
    prompt = f"<drift_json>\n{json.dumps(payload_to_llm, indent=2)}\n</drift_json>\nExplain the changes in one sentence:"
    
    # Meta Llama 3 8B Instruct system/user format
    formatted_prompt = (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>"
        f"<|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|>"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    
    try:
        body = json.dumps({
            "prompt": formatted_prompt,
            "max_gen_len": 128,
            "temperature": 0.2,
            "top_p": 0.9
        })
        
        response = bedrock.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body
        )
        
        response_body = json.loads(response.get('body').read())
        generation = response_body.get('generation', '').strip()
        
        # Clean up any potential markdown headers or extra quotes
        generation = generation.replace('"', '').strip()
        print(f"Bedrock Explanation: {generation}")
        return generation
        
    except Exception as e:
        print(f"Bedrock invocation failed: {str(e)}")
        # Fallback explanation if LLM fails
        diff_desc = ", ".join([f"{d.get('PropertyPath')} changed" for d in diffs]) if diffs else "properties modified"
        return f"{resource_type} ({logical_id}) was {drift_status} ({diff_desc})."

def save_drift_to_db(stack_name, timestamp, status, drifts, friendly_summary, check_type):
    """
    Saves the check record to DynamoDB DriftHistory table.
    """
    try:
        table = ddb.Table(TABLE_NAME)
        
        # Convert floats to decimals or sanitize types for DynamoDB if any nested floats exist
        sanitized_drifts = json.loads(json.dumps(drifts, default=str))
        
        item = {
            'StackName': stack_name,
            'Timestamp': timestamp,
            'Status': status,
            'Drifts': sanitized_drifts,
            'FriendlySummary': friendly_summary,
            'CheckType': check_type
        }
        
        table.put_item(Item=item)
        print(f"Successfully logged check to DynamoDB for stack {stack_name} at {timestamp}.")
    except Exception as e:
        print(f"Failed to save check to DynamoDB: {str(e)}")

def send_sns_alert(stack_name, summary, timestamp):
    """
    Sends email notification via Amazon SNS.
    """
    try:
        subject = f"⚠️ AWS DRIFT DETECTED in stack: {stack_name}"
        message = (
            f"Infrastructure Drift Alert\n"
            f"===========================\n"
            f"Stack Name: {stack_name}\n"
            f"Detected At: {timestamp}\n\n"
            f"What Changed:\n{summary}\n\n"
            f"Please visit your Drift Control Dashboard to review details and sync changes."
        )
        
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message
        )
        print(f"SNS Alert published to topic: {SNS_TOPIC_ARN}")
    except Exception as e:
        print(f"Failed to publish SNS notification: {str(e)}")
