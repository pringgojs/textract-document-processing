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
    all_text = ""

    print(request)

    jobId = request['jobId']
    jobTag = request['jobTag']
    jobStatus = request['jobStatus']
    jobAPI = request['jobAPI']
    bucketName = request['bucketName']
    objectName = request['objectName']
    documentsTable = request["documentsTable"]

    pages = getJobResults(jobAPI, jobId)

    print("Result pages recieved: {}".format(len(pages)))

    detectForms = False
    detectTables = False
    if(jobAPI == "StartDocumentAnalysis"):
        detectForms = True
        detectTables = True

    # Start - Store the key-value sets in DynamoDB Document Metadata table
    document = Document(pages)
    if (document.pages):
        print("Total Pages in Document: {}".format(len(document.pages)))

        kvsets = []
        for page in document.pages:
            if (detectForms):
                for field in page.form.fields:
                    print("field: {}".format(field))
                    kvset  = {}
                    if(field.key):
                        kvset["key"] = field.key.text
                        kvset["position_top"] = Decimal(str(field.key.geometry.boundingBox.top))
                        kvset["position_left"] = Decimal(str(field.key.geometry.boundingBox.left))
                        kvset["confidence"] = Decimal(str(field.key.confidence))

                    if(field.value):
                        kvset["value"] = field.value.text
                    else:
                        kvset["value"] = ""

                    kvsets.append(kvset)
            
            all_text = all_text + " " + page.text

        id = None
        doctype = "UNKNOWN"
        for kvset in kvsets:
            print("kvset: {}".format(kvset))
            if ("key" in kvset and (kvset["key"].lower() == "nib" or kvset["key"].lower()[-3:] == "nib")):
                id = kvset["value"]
        #       doctype = "BUKU TANAH"
                break

        # try once more to get ID from raw text
        if (not id):
            id =  all_text[all_text.find("NIB"):all_text.find("\n",all_text.find("NIB")+5)].replace(":","").replace(" ","").replace("NIB","").replace("\n","")
        
        if (not id):
            id = str(uuid.uuid4())



        #for kvset in kvsets:
        #    if ("key" in kvset and (kvset["key"].lower().find("keadaan tanah") != -1 or kvset["key"].lower() .find("peta") != -1)):
        #        #doctype = "SURAT UKUR"
        #        break
        
        
        luas =""
        # get doc type from all text
        if (all_text.lower().find("sebidang tanah terletak dalam") != -1 or all_text.lower() .find("keadaan tanah") != -1):
            doctype = "SURAT UKUR"
            l1 = re.findall("[0-9]* m2",all_text)
            if l1:
                luas = l1[0]
            
        if (all_text.lower().find("nama pemegang hak") != -1 or all_text.lower() .find("pendaftaran peralihan hak") != -1):
            doctype = "BUKU TANAH"
        
        r1 = re.findall("[0-9][0-9][.][0-9][0-9][.][0-9][0-9][.][0-9][0-9][.][0-9][.][0-9][0-9][0-9][0-9][0-9]",all_text.replace("\n",""))
        
        nomor_seri = ""
        if r1:
            nomor_seri = r1[0]    

        dynamodb = boto3.resource('dynamodb')
        metadataTable = dynamodb.Table(os.environ["DOCUMENT_METADATA_TABLE"])
        # insert all text as well for future use
        print("Creating a new document in the Document Metadata table with id: {} , doctype: {} and kvsets: {}".format(id, doctype, kvsets))
        response = metadataTable.put_item(
            Item={
                'id': id,
                'doctype':doctype,
                'kvsets': kvsets,
                'text': all_text,
                'nomor_seri': nomor_seri,
                'luas': luas
            }
        )
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
