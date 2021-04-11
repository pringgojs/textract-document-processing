import * as cdk from '@aws-cdk/core';
import events = require('@aws-cdk/aws-events');
import iam = require('@aws-cdk/aws-iam');
import { S3EventSource, SqsEventSource, SnsEventSource, DynamoEventSource } from '@aws-cdk/aws-lambda-event-sources';
import sns = require('@aws-cdk/aws-sns');
import snsSubscriptions = require("@aws-cdk/aws-sns-subscriptions");
import sqs = require('@aws-cdk/aws-sqs');
import dynamodb = require('@aws-cdk/aws-dynamodb');
import lambda = require('@aws-cdk/aws-lambda');
import s3 = require('@aws-cdk/aws-s3');
import cognito = require('@aws-cdk/aws-cognito');
import apigateway = require("@aws-cdk/aws-apigateway");
import {LambdaFunction} from "@aws-cdk/aws-events-targets";
import { AuthorizationType } from '@aws-cdk/aws-apigateway';
import { OAuthScope, ResourceServerScope } from '@aws-cdk/aws-cognito';
import { Stack } from '@aws-cdk/core';

export class TextractPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    
    //**********SNS Topics******************************
    const jobCompletionTopic = new sns.Topic(this, 'JobCompletion');

    //**********IAM Roles******************************
    const textractServiceRole = new iam.Role(this, 'TextractServiceRole', {
      assumedBy: new iam.ServicePrincipal('textract.amazonaws.com')
    });
    textractServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [jobCompletionTopic.topicArn],
        actions: ["sns:Publish"]
      })
    );


    //**********S3 Batch Operations Role******************************
    const s3BatchOperationsRole = new iam.Role(this, 'S3BatchOperationsRole', {
      assumedBy: new iam.ServicePrincipal('batchoperations.s3.amazonaws.com')
    });

    //**********S3 Bucket******************************
    //S3 bucket for input documents and output
    const contentBucket = new s3.Bucket(this, 'DocumentsBucket', { versioned: false});

    const inventoryAndLogsBucket = new s3.Bucket(this, 'InventoryAndLogsBucket', { versioned: false});
    inventoryAndLogsBucket.grantReadWrite(s3BatchOperationsRole)

    //**********DynamoDB Table*************************
    //DynamoDB table with links to output in S3
    const documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    // Document metadata table
    const documentMetadataTable = new dynamodb.Table(this, 'DocumentMetadataTable', {
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    //**********SQS Queues*****************************
    //DLQ
    const dlq = new sqs.Queue(this, 'DLQ', {
      visibilityTimeout: cdk.Duration.seconds(30), retentionPeriod: cdk.Duration.seconds(1209600)
    });

    //Input Queue for async jobs
    const asyncJobsQueue = new sqs.Queue(this, 'AsyncJobs', {
      visibilityTimeout: cdk.Duration.seconds(30), retentionPeriod: cdk.Duration.seconds(1209600), deadLetterQueue : { queue: dlq, maxReceiveCount: 50}
    });

    //Queue
    const jobResultsQueue = new sqs.Queue(this, 'JobResults', {
      visibilityTimeout: cdk.Duration.seconds(900), retentionPeriod: cdk.Duration.seconds(1209600), deadLetterQueue : { queue: dlq, maxReceiveCount: 50}
    });
    //Trigger
    //jobCompletionTopic.subscribeQueue(jobResultsQueue);
    jobCompletionTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(jobResultsQueue)
    );

    //**********Lambda Functions******************************

    // Helper Layer with helper functions
    const helperLayer = new lambda.LayerVersion(this, 'HelperLayer', {
      code: lambda.Code.fromAsset('lambda/helper'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_7],
      license: 'Apache-2.0',
      description: 'Helper layer.',
    });

    // Textractor helper layer
    const textractorLayer = new lambda.LayerVersion(this, 'Textractor', {
      code: lambda.Code.fromAsset('lambda/textractor'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_7],
      license: 'Apache-2.0',
      description: 'Textractor layer.',
    });

    //------------------------------------------------------------

    // S3 Event processor
    const s3Processor = new lambda.Function(this, 'S3Processor', {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.asset('lambda/s3processor'),
      handler: 'lambda_function.lambda_handler',
      timeout: cdk.Duration.seconds(30),
      environment: {
        ASYNC_QUEUE_URL: asyncJobsQueue.queueUrl,
        DOCUMENTS_TABLE: documentsTable.tableName
      }
    });
    //Layer
    s3Processor.addLayers(helperLayer)
    //Trigger
    s3Processor.addEventSource(new S3EventSource(contentBucket, {
      events: [ s3.EventType.OBJECT_CREATED ],
      filters: [ { suffix: '.pdf' }]
    }));
    s3Processor.addEventSource(new S3EventSource(contentBucket, {
      events: [ s3.EventType.OBJECT_CREATED ],
      filters: [ { suffix: '.png' }]
    }));
    s3Processor.addEventSource(new S3EventSource(contentBucket, {
      events: [ s3.EventType.OBJECT_CREATED ],
      filters: [ { suffix: '.jpg' }]
    }));
    s3Processor.addEventSource(new S3EventSource(contentBucket, {
      events: [ s3.EventType.OBJECT_CREATED ],
      filters: [ { suffix: '.jpeg' }]
    }));
    //Permissions
    documentsTable.grantReadWriteData(s3Processor)
    asyncJobsQueue.grantSendMessages(s3Processor)
    //------------------------------------------------------------

    // Document processor (Router to Sync/Async Pipeline)
    const documentProcessor = new lambda.Function(this, 'TaskProcessor', {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.asset('lambda/documentprocessor'),
      handler: 'lambda_function.lambda_handler',
      timeout: cdk.Duration.seconds(900),
      environment: {
        ASYNC_QUEUE_URL: asyncJobsQueue.queueUrl
      }
    });
    //Layer
    documentProcessor.addLayers(helperLayer)
    //Trigger
    documentProcessor.addEventSource(new DynamoEventSource(documentsTable, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON
    }));

    //Permissions
    documentsTable.grantReadWriteData(documentProcessor)
    asyncJobsQueue.grantSendMessages(documentProcessor)

    //------------------------------------------------------------

    // Async Job Processor (Start jobs using Async APIs)
    const asyncProcessor = new lambda.Function(this, 'ASyncProcessor', {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.asset('lambda/asyncprocessor'),
      handler: 'lambda_function.lambda_handler',
      reservedConcurrentExecutions: 1,
      timeout: cdk.Duration.seconds(60),
      environment: {
        ASYNC_QUEUE_URL: asyncJobsQueue.queueUrl,
        SNS_TOPIC_ARN : jobCompletionTopic.topicArn,
        SNS_ROLE_ARN : textractServiceRole.roleArn,
        AWS_DATA_PATH : "models"
      }
    });
    //asyncProcessor.addEnvironment("SNS_TOPIC_ARN", textractServiceRole.topicArn)

    //Layer
    asyncProcessor.addLayers(helperLayer)
    //Triggers
    // Run async job processor every 5 minutes
    //Enable code below after test deploy
     const rule = new events.Rule(this, 'Rule', {
       schedule: events.Schedule.expression('rate(2 minutes)')
     });
     rule.addTarget(new LambdaFunction(asyncProcessor));

    //Run when a job is successfully complete
    asyncProcessor.addEventSource(new SnsEventSource(jobCompletionTopic))
    //Permissions
    contentBucket.grantRead(asyncProcessor)
    asyncJobsQueue.grantConsumeMessages(asyncProcessor)
    asyncProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [textractServiceRole.roleArn]
      })
    );
    asyncProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["textract:*"],
        resources: ["*"]
      })
    );
    //------------------------------------------------------------

    // Async Jobs Results Processor
    const jobResultProcessor = new lambda.Function(this, 'JobResultProcessor', {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.asset('lambda/jobresultprocessor'),
      handler: 'lambda_function.lambda_handler',
      memorySize: 2000,
      reservedConcurrentExecutions: 50,
      timeout: cdk.Duration.seconds(900),
      environment: {
        DOCUMENTS_TABLE: documentsTable.tableName,
        AWS_DATA_PATH : "models",
        DOCUMENT_METADATA_TABLE: documentMetadataTable.tableName
      }
    });
    //Layer
    jobResultProcessor.addLayers(helperLayer)
    jobResultProcessor.addLayers(textractorLayer)
    //Triggers
    jobResultProcessor.addEventSource(new SqsEventSource(jobResultsQueue, {
      batchSize: 1
    }));
    //Permissions
    documentsTable.grantReadWriteData(jobResultProcessor)
    contentBucket.grantReadWrite(jobResultProcessor)
    documentMetadataTable.grantReadWriteData(jobResultProcessor);
    jobResultProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["textract:*"],
        resources: ["*"]
      })
    );

    //--------------
    // PDF Generator
    const pdfGenerator = new lambda.Function(this, 'PdfGenerator', {
      runtime: lambda.Runtime.JAVA_8,
      code: lambda.Code.asset('lambda/pdfgenerator'),
      handler: 'DemoLambdaV2::handleRequest',
      memorySize: 3000,
      timeout: cdk.Duration.seconds(900),
    });
    contentBucket.grantReadWrite(pdfGenerator)
    pdfGenerator.grantInvoke(asyncProcessor)

    //--------------
    // Get Document Metadata service
    const documentMetadataController = new lambda.Function(this, "DocumentMetadataController", {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.fromAsset('lambda/docmetadatacontroller'),
      handler: 'lambda_function.lambda_handler',
      timeout: cdk.Duration.seconds(60),
      environment: {
        DOCUMENT_METADATA_TABLE: documentMetadataTable.tableName
      }
    });
    documentMetadataTable.grantReadData(documentMetadataController);

    const documentMetadataApi = new apigateway.RestApi(this, "document-metadata-api", {
      restApiName: "Document Metadata Service",
      description: "This services serves the content from the output table from the Textract Document Processing stored in DynamoDB"
    });

    const document = documentMetadataApi.root.addResource("{id}");
    const getDocumentMetadataIntegration = new apigateway.LambdaIntegration(documentMetadataController);

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "default-userpool"
    });
    const resourceServer = new cognito.CfnUserPoolResourceServer(this, "CognitoResourceServer", {
      identifier: "https://documentmetadata",
      name: "DocumentMetadataService",
      userPoolId: userPool.userPoolId,
      scopes: [
        {
          scopeDescription: "Allow read",
          scopeName: "read",
        },
      ],
    });
    const client = userPool.addClient('appclient', {
      oAuth: {
        flows: { 
          clientCredentials: true 
        },
        scopes: [OAuthScope.custom('https://documentmetadata/read')]
      },
      generateSecret: true
    });
    userPool.addDomain("CognitoDomain", {
      cognitoDomain: {
        domainPrefix: `documentmetadata-userpool-${this.account}`
      }
    });

    // Cognito Authorizer for API Gateway
    const auth = new apigateway.CfnAuthorizer(this, 'APIGatewayAuthorizer', {
      name: 'document-metadata-authorizer',
      identitySource: 'method.request.header.Authorization',
      providerArns: [userPool.userPoolArn],
      restApiId: documentMetadataApi.restApiId,
      type: AuthorizationType.COGNITO,
    });

    // API Gateway GET method with authorizer
    document.addMethod("GET", getDocumentMetadataIntegration, {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: { authorizerId: auth.ref },
      authorizationScopes: ["https://documentmetadata/read"]
    }); // GET /{id}

    //--------------
    // Sanity Checker
    const sanityChecker = new lambda.Function(this, "SanityChecker", {
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.fromAsset('lambda/sanitychecker'),
      handler: 'lambda_function.lambda_handler',
      timeout: cdk.Duration.seconds(60),
      environment: {
        DOCUMENT_METADATA_TABLE: documentMetadataTable.tableName
      }
    });
    documentMetadataTable.grantReadWriteData(sanityChecker);
    sanityChecker.addEventSource(new DynamoEventSource(documentMetadataTable, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON
    }));
  }
}
