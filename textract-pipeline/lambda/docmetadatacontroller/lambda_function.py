import boto3
import os
import json
from decimal import Decimal
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ["DOCUMENT_METADATA_TABLE"])

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super(DecimalEncoder, self).default(o)

def getAllDocumentMetadata():
    try:
        done = False
        start_key = None
        data = []
        scan_kwargs = {}
        while not done:
            if start_key:
                scan_kwargs['ExclusiveStartKey'] = start_key
            response = table.scan(**scan_kwargs)
            print(response)
            if "Items" in response:
                data = data + response['Items']
            
            start_key = response.get('LastEvaluatedKey', None)
            done = start_key is None
        
        return data

    except ClientError as e:
        print(e.response['Error']['Message'])

def getDocumentMetadata(documentId: str):
    try:
        response = table.get_item(Key={'documentId': documentId})
        print(response)
        if "Item" in response:
            return response['Item']
        else:
            return None
    except ClientError as e:
        print(e.response['Error']['Message'])

def lambda_handler(event, context):
    try:
        method = event["httpMethod"]
        path = event["path"]
        queryStringParameters = event["queryStringParameters"]
        print("method: " + method)
        print("path: " + path) 
        print("queryStringParameters: {}".format(queryStringParameters))

        if (method != "GET"):
            return {
                "statusCode": 400,
                "headers": {},
                "body": "We only accept GET"
            }
            
        if (path.startswith("/") and path != "/"):
            # Get the resource id removing "/" from the path
            documentId = path[1:]
            data = getDocumentMetadata(documentId)
            print("data: {}".format(data))
            if (data != None):
                return {
                    "statusCode": 200,
                    "headers": {
                        "Content-Type": "application/json"
                    },
                    "body": json.dumps(data, cls=DecimalEncoder)
                }
            else:
                return {
                    "statusCode": 404,
                    "headers": {}
                }
        else:
            data = getAllDocumentMetadata()
            print("data: {}".format(data))
            if (data != None):
                return {
                    "statusCode": 200,
                    "headers": {
                        "Content-Type": "application/json"
                    },
                    "body": json.dumps(data, cls=DecimalEncoder)
                }
            else:
                return {
                    "statusCode": 404,
                    "headers": {}
                }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": json.dumps({ 'errorMessage': str(e) })
        }