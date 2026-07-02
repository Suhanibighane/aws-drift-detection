import os
import json
import boto3
from boto3.dynamodb.conditions import Key

# Initialize DynamoDB Resource
ddb = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'DriftHistory')

def lambda_handler(event, context):
    """
    Retrieves the drift history log for a specific stack or lists all logs.
    Handles CORS headers for React Dashboard integration.
    """
    print("Received event:", json.dumps(event))
    
    # Enable CORS headers for the React dashboard
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
    }
    
    # Handle preflight OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }
        
    query_params = event.get('queryStringParameters') or {}
    stack_name = query_params.get('stack_name')
    limit = int(query_params.get('limit', '50'))
    
    try:
        table = ddb.Table(TABLE_NAME)
        
        if stack_name:
            # Query history for a specific stack (efficient query using index/partition key)
            print(f"Querying history for stack: {stack_name}")
            response = table.query(
                KeyConditionExpression=Key('StackName').eq(stack_name),
                ScanIndexForward=False, # Descending order (latest first)
                Limit=limit
            )
            items = response.get('Items', [])
        else:
            # Scan table if no specific stack is provided
            print("Scanning DynamoDB table for history")
            response = table.scan(Limit=limit)
            items = response.get('Items', [])
            # Sort items manually since Scan doesn't guarantee order
            items = sorted(items, key=lambda x: x.get('Timestamp', ''), reverse=True)
            
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'count': len(items),
                'history': items
            }, default=str)
        }
        
    except Exception as e:
        print(f"Error querying history: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)})
        }
