import json
import os
import boto3
import time
import uuid
from helper import AwsHelper
from og import OutputGenerator
from trp import Document
from decimal import Decimal
import datastore
import re

def getJobResults(api, jobId):

    pages = []

    time.sleep(5)

    client = AwsHelper().getClient('textract')
    if(api == "StartDocumentTextDetection"):
        response = client.get_document_text_detection(JobId=jobId)
    else:
        response = client.get_document_analysis(JobId=jobId)
    pages.append(response)
    print("Resultset page recieved: {}".format(len(pages)))
    nextToken = None
    if('NextToken' in response):
        nextToken = response['NextToken']
        print("Next token: {}".format(nextToken))

    while(nextToken):
        time.sleep(5)

        if(api == "StartDocumentTextDetection"):
            response = client.get_document_text_detection(JobId=jobId, NextToken=nextToken)
        else:
            response = client.get_document_analysis(JobId=jobId, NextToken=nextToken)

        pages.append(response)
        print("Resultset page recieved: {}".format(len(pages)))
        nextToken = None
        if('NextToken' in response):
            nextToken = response['NextToken']
            print("Next token: {}".format(nextToken))

    return pages

def processRequest(request):

    output = ""

    print(request)

    jobId = request['jobId']
    jobTag = request['jobTag']
    jobAPI = request['jobAPI']
    bucketName = request['bucketName']
    objectName = request['objectName']
    documentsTable = request["documentsTable"]

    pages = getJobResults(jobAPI, jobId)

    print("Result pages recieved: {}".format(len(pages)))

    detectForms = False
    if(jobAPI == "StartDocumentAnalysis"):
        detectForms = True

    # Start - Store the key-value sets in DynamoDB Document Metadata table
    document = Document(pages)
    if (document.pages):
        print("Total Pages in Document: {}".format(len(document.pages)))

        documentItem = {
            'documentId': jobTag,
            'documentName': objectName,
        }

        allText = ""
        kvsets = []
        for page in document.pages:
            allText = allText + page.text
            if (detectForms):
                for field in page.form.fields:
                    kvset  = {}
                    if(field.key):
                        kvset["key"] = field.key.text
                        kvset["key_position_top"] = Decimal(str(field.key.geometry.boundingBox.top))
                        kvset["key_position_left"] = Decimal(str(field.key.geometry.boundingBox.left))
                        kvset["key_position_width"] = Decimal(str(field.key.geometry.boundingBox.width))
                        kvset["key_position_height"] = Decimal(str(field.key.geometry.boundingBox.height))
                        kvset["key_confidence"] = Decimal(str(field.key.confidence))

                        if(field.value):
                            documentItem[field.key.text] = field.value.text
                            kvset["value"] = field.value.text
                            kvset["value_position_top"] = Decimal(str(field.value.geometry.boundingBox.top))
                            kvset["value_position_left"] = Decimal(str(field.value.geometry.boundingBox.left))
                            kvset["value_position_width"] = Decimal(str(field.value.geometry.boundingBox.width))
                            kvset["value_position_height"] = Decimal(str(field.value.geometry.boundingBox.height))
                            kvset["value_confidence"] = Decimal(str(field.value.confidence))
                        else:
                            documentItem[field.key.text] = ""
                            kvset["value"] = ""
                    kvsets.append(kvset)
        documentItem["allText"] = allText
        documentItem['forms'] = kvsets

        print("DEBUG - documentItem: {}".format(documentItem))

        dynamodb = boto3.resource('dynamodb')
        metadataTable = dynamodb.Table(os.environ["DOCUMENT_METADATA_TABLE"])
        print("Creating a new item in the Document Metadata table with content: {}".format(documentItem))
        response = metadataTable.put_item(Item = documentItem)
        print("Response: {}".format(response))
    # End - store the key-value sets in DynamoDB Document Metadata table

    print("DocumentId: {}".format(jobTag))
    ds = datastore.DocumentStore(documentsTable)
    ds.markDocumentComplete(jobTag)

    output = "Processed -> Document: {}, Object: {}/{} processed.".format(jobTag, bucketName, objectName)
    print(output)

    return {
        'statusCode': 200,
        'body': output
    }

def lambda_handler(event, context):

    print("event: {}".format(event))

    body = json.loads(event['Records'][0]['body'])
    message = json.loads(body['Message'])

    print("Message: {}".format(message))

    request = {}

    request["jobId"] = message['JobId']
    request["jobTag"] = message['JobTag']
    request["jobStatus"] = message['Status']
    request["jobAPI"] = message['API']
    request["bucketName"] = message['DocumentLocation']['S3Bucket']
    request["objectName"] = message['DocumentLocation']['S3ObjectName']
    
    request["documentsTable"] = os.environ['DOCUMENTS_TABLE']

    return processRequest(request)

def lambda_handler_local(event, context):
    print("event: {}".format(event))
    return processRequest(event)
