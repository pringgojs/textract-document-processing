import boto3
import os
import json
import re
from decimal import Decimal
from botocore.exceptions import ClientError

def updateRecordVerificationStatus(id, doctype, passed):
    dynamodb = boto3.resource('dynamodb')
    metadataTable = dynamodb.Table(os.environ["DOCUMENT_METADATA_TABLE"])
    print("Updating the verification status on the record id: {} with result: {}".format(id, passed))

    response = metadataTable.update_item(
        Key={
            'id': id,
            'doctype': doctype
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
    
    id = None
    doctype = None
    # Additional key-value pairs to be checked.
    nib = None
    nibConfidence = None
    
    if("id" in newImage and "S" in newImage["id"]):
        id = newImage["id"]["S"]

    if("doctype" in newImage and "S" in newImage["doctype"]):
        doctype = newImage["doctype"]["S"]

    if("kvsets" in newImage and "L" in newImage["kvsets"]):
        for kvset in newImage["kvsets"]["L"]:
            map = kvset["M"]
            key = None
            value = None
            confidence = None

            for k,v in map.items():
                print ("k: {}, v: {}".format(k, v))
                if (k == "key" and "S" in v):
                    key = v["S"]
                if (k == "value" and "S" in v):
                    value = v["S"]
                if (k == "confidence" and "N" in v):
                    confidence = v["N"]
                
            if (key and key.lower() == "nib"):
                nib = value
                nibConfidence = confidence

    print("id: {}, doctype: {}, nib: {}, nib confidence: {}".format(id, doctype, nib, nibConfidence))

    passed = "false"
    print("Checking if NIB exists")
    if (id and doctype and nib):
        print("NIB exists.")
        print("Checking if the NIB confidence level is above 20")
        if (Decimal(nibConfidence) > 20):
            print("NIB confidence is above 20.")
            print("Checking if NIB follows the pattern of 8-digits number followed with dot (.) and followed with 5-digits number")
            if (re.search(r"^[0-9]{8}\.{1}[0-9]{5}$", nib)):
                print("The NIB follows the pattern")
                passed = "true"

    updateRecordVerificationStatus(id, doctype, passed)


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