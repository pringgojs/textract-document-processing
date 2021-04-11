import boto3
import os
import json
import re
from decimal import Decimal
from botocore.exceptions import ClientError

def updateRecordVerificationStatus(documentId, passed):
    dynamodb = boto3.resource('dynamodb')
    metadataTable = dynamodb.Table(os.environ["DOCUMENT_METADATA_TABLE"])
    print("Updating the verification status on the record documentId: {} with result: {}".format(documentId, passed))

    response = metadataTable.update_item(
        Key={
            'documentId': documentId
        },
        UpdateExpression="set passedSanityCheck=:p",
        ExpressionAttributeValues={
            ':p': passed
        },
        ReturnValues="UPDATED_NEW"
    )
    return response

def checkRecord(record): 
    newImage = record["dynamodb"]["NewImage"]

    if ("passedSanityCheck" in newImage and "S" in newImage["passedSanityCheck"]):
        print("Record already have sanity check results with value: {}. Skipping the record.".format(newImage["passedSanityCheck"]["S"]))
        return
    
    documentId = None
    # Additional key-value pairs to be checked. For example name, address, etc.
    # nama = None
    
    if("documentId" in newImage and "S" in newImage["documentId"]):
        documentId = newImage["documentId"]["S"]

    # Process any additional validation here.
    # For example Regex validation or confidence validation.
    passed = "false"
    print("Checking if NIB exists")
    if (documentId):
        passed = "true"

    updateRecordVerificationStatus(documentId, passed)


def lambda_handler(event, context):
    try:
        print("event: {}".format(event))

        if("Records" in event and event["Records"]):
            for record in event["Records"]:
                try:
                    print("Processing record: {}".format(record))

                    if("eventName" in record and (record["eventName"] == "INSERT" or record["eventName"] == "MODIFY")):
                        if("dynamodb" in record and record["dynamodb"] and "NewImage" in record["dynamodb"]):
                            checkRecord(record)

                except Exception as e:
                    print("Failed to process record. Exception: {}".format(e))

    except Exception as e:
        print("Failed to process records. Exception: {}".format(e))