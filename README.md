# Textract Document Processing

## Overview
Amazon Textract is a machine learning service that automatically extracts text, handwriting and data from scanned documents that goes beyond simple optical character recognition (OCR) to identify, understand, and extract data from forms and tables. Textract uses machine learning to read and process any type of document, accurately extracting text, handwriting, tables and other data without any manual effort. You can quickly automate document processing and take action on the information extracted whether it be automating loans processing or tax documents. Textract can extract the data in minutes vs. hours or days.

This project leverages the form data extraction capability of Amazon Textract to automatically extract the form data from the uploaded documents and insert it as an item in the database to be retrieved and processed as required.

For example, many businesses and institutions who are yet to transform their process to become more digitalized are often doing manual data entry for form-based information such as identity card, paper-based registration form, and others. This manual process consumes too much time and is not scalable. The project is designed to improve the process by automating the manual process with the helps of review from the automated verification based on the business logic, as well as human verification.

## Architecture
This project is derived from the [Large scale document processing with Amazon Textract](https://github.com/aws-samples/amazon-textract-serverless-large-scale-document-processing) as the base / foundation, so credits goes to the initial contributors in the linked project page.

The following is the high-level architecture diagram. It is implemented using AWS Serverless technology.

![Diagram](diagram.jpg)

The project leverages on Amazon Textract Asynchronous multi-page processing. It supports detecting and analyzing multi-page PDF files. 

The project also includes a frontend project based on React Web that is decoupled from the Backend Processing, Authentication, and API Infrastructure. In this example, the frontend web UI can be hosted on AWS Amplify. 

As the frontend is decoupled from the backend, it can be replaced with new or existing user interfaces that you already have.

The workflow can be summarized as follow:
1. User access the frontend client, in this case React Web Application.
2. User then authenticate with Cognito.
3. Once authenticated, user can start uploading the document into the S3 Ingest Bucket with name `documentsbucket`.
4. Upon uploaded item, S3 Ingest Bucket will trigger S3 object created event to `s3proc` Lambda Function which will register the document and job information into a DynamoDB table called `DocumentsTable`.
5. DynamoDB Stream will trigger the `docproc` Lambda Function which will enqueue a message into SQS to list the document as part of the next batch of processing.
6. A Lambda Function with name `asyncproc` is scheduled to run every x minutes that will poll the message from the SQS and will submit the text detection and analysis job to Amazon Textract.
7. Amazon Textract will process the job asynchronously, once finished it sends the job completed notification to SNS which will post a message into SQS and will trigger a Lambda Function called `jobresultsproc`.
8. `jobresultsproc` Lambda Function will retrieve the job results, parse it, and will store the detected forms / key-value pairs information into a DynamoDB table called `DocumentMetadata`.
9. A DynamoDB Stream will trigger the `SanityChecker` Lambda Function that will evaluate the results. The evaluation status will be updated on the record. The evaluation criterias is flexible and can be modified as required by the business logic.
10. Client can retrieve the data stored in the DynamoDB table by using Lambda Function `DocumentMetadataController` that is exposed using API Gateway. In this case the React Web Application will fetch the data and display the data in the page.

## Deploying the Solution
### Prerequisites
1. Install NPM here if you haven't: https://www.npmjs.com/get-npm
2. Install CDK, refer here: https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install

### Deploying the Backend
1. Clone the repository
2. Go to the `textract-pipeline` directory and run `npm install` to restore the packages
3. Bootstrapping CDK deployment in your AWS account `cdk bootstrap`
4. Deploy the stack using `cdk deploy`
5. Once deployed, you can find the output references that you will use as configuration in the frontend. You can also check the outputs in the CloudFormation console if required.
6. You can delete the stack by using `cdk destroy`

### Running the Frontend React Web UI
1. Modify the `web-ui/src/config.json` file with the outputs from the CDK deployment.
2. You can run the frontend locally with `npm start` or `yarn start`
3. If required, you can host the application in Amplify Web Hosting by referring to this [documentation](https://docs.amplify.aws/cli/hosting) and this [documentation](https://docs.amplify.aws/start/getting-started/hosting/q/integration/react).

### Troubleshooting
1. Troubleshoot backend issues by checking on CloudWatch Logs

## Development
### Setting up and Deployment
1. Clone the repository
2. Go to the `textract-pipeline` directory and run `npm install` to restore the packages
3. Produce and view CloudFormation template if needed `cdk synth`
4. Produce and export CloudFormation template if needed `cdk synth -o textractcf`
5. Deploy changes `cdk bootstrap` and `cdk deploy`

### Source Code
| File | Description |
| ---- | ---- |
| web-ui/ | Frontend React Web Application. |
| s3processor/lambda_function.py | Lambda function that handles s3 event for an object creation. |
| documentprocessor/lambda_function.py | Lambda function that push documents to queues for sync or async pipelines. |
| asyncprocessor/lambda_function.py | Lambda function that takes documents from a queue and start async Amazon Textract jobs. |
| jobresultsprocessor/lambda_function.py | Lambda function that process results for a completed Amazon Textract async job. |
| docmetadatacontroller/lambda_function.py | Lambda function that fetch the document metadata from DynamoDB DocumentMetadata table and return it to the clients |
| sanitychecker/lambda_function.py | Lambda function that performs verification based on rules such as key-value pairs existence and update the record in the DynamoDB DocumentMetadata table with the verification status. |
| lib/textract-pipeline-stack.ts | CDK code to define infrastrucure including IAM roles, Lambda functions, SQS queues etc. |

### CI/CD environment
You can create a simple CodePipeline with CodeBuild to continuously deploy changes by using the `textract-pipeline/buildspec.yml` buildspec file.