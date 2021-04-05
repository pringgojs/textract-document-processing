import boto3
import os
import json
from decimal import Decimal
from botocore.exceptions import ClientError

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super(DecimalEncoder, self).default(o)

def getDocumentMetadata(id: str, doctype: str):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(os.environ["DOCUMENT_METADATA_TABLE"])

    try:
        response = table.get_item(Key={'id': id, 'doctype': doctype})
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
            id = path[1:]

            # Get the doctype from the query string
            if (queryStringParameters and "doctype" in queryStringParameters):
                doctype = queryStringParameters["doctype"]
                data = getDocumentMetadata(id, doctype)
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
                return {
                    "statusCode": 400,
                    "headers": {},
                    "body": "Please specify the doctype in the query string e.g. GET /[id]?doctype=[doctype]"
                }
        else:
            return {
                "statusCode": 400,
                "headers": {},
                "body": "Please specify the ID: GET /[id]"
            }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": json.dumps({ 'errorMessage': str(e) })
        }