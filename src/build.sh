echo "Copying lambda functions..."
cp helper.py ../textract-pipeline/lambda/helper/python/helper.py
cp datastore.py ../textract-pipeline/lambda/helper/python/datastore.py
cp s3proc.py ../textract-pipeline/lambda/s3processor/lambda_function.py
cp docproc.py ../textract-pipeline/lambda/documentprocessor/lambda_function.py
cp asyncproc.py ../textract-pipeline/lambda/asyncprocessor/lambda_function.py
cp jobresultsproc.py ../textract-pipeline/lambda/jobresultprocessor/lambda_function.py
cp docmetadatacontroller.py ../textract-pipeline/lambda/docmetadatacontroller/lambda_function.py
cp sanitychecker.py ../textract-pipeline/lambda/sanitychecker/lambda_function.py

cp trp.py ../textract-pipeline/lambda/textractor/python/trp.py
cp og.py ../textract-pipeline/lambda/textractor/python/og.py

echo "Done!"
