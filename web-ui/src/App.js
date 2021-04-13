import React, { Component } from 'react';
import { withAuthenticator, AmplifySignOut } from '@aws-amplify/ui-react';
import { Auth, API } from 'aws-amplify';
import AWS from 'aws-sdk';

import { Button, Box, Paper, Grid, Typography, AppBar, Toolbar } from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import { withStyles } from '@material-ui/core/styles';
import ReactJson from 'react-json-view'

import config from "./config.json";

const styles = theme => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  button: {
    margin: theme.spacing(1),
  },
  title: {
    flexGrow: 1,
  },
});

const s3DocumentsBucketName = config.DOCUMENTS_UPLOAD_BUCKET.BUCKET_NAME;
const s3DocumentsBucketRegion = config.DOCUMENTS_UPLOAD_BUCKET.BUCKET_REGION;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      progress: 0,
      selectedFile: null,
      uploadState: "Not Started",
      selectedFileName: "No file chosen",
      documentMetadataItems: []
    };
  }
  
  async componentDidMount() {
    try {
      let creds = await Auth.currentCredentials();
      AWS.config.update({
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
        region: s3DocumentsBucketRegion
      });

      await this.refreshDocumentMetadata();
    } catch (error) {
      console.log(error);
    }
  }

  handleFileInput = (e) => {
    this.setState({ selectedFile: e.target.files[0] });
    this.setState({ selectedFileName: e.target.files[0].name });
  };

  uploadFile = async (file) => {
    if (file == null) {
      return;
    }

    var upload = new AWS.S3.ManagedUpload({
      params: {
        Body: file,
        Bucket: s3DocumentsBucketName,
        Key: file.name
      }
    });

    try {
      await upload.on('httpUploadProgress', (evt) => {
        this.setState({ progress: Math.round((evt.loaded / evt.total) * 100)});
      }).promise();
      this.setState({ uploadState: "Succeed"});
    } catch(e) {
      console.log(e);
      this.setState({ uploadState: "Failed"});
    }
  }

  getDocumentMetadata = () => { 
    const apiName = 'DocumentMetadataService';
    const path = '';
    const init = {
      headers: {},
    };
  
    return API.get(apiName, path, init);
  }

  refreshDocumentMetadata = async () => { 
    const response = await this.getDocumentMetadata();
    this.setState({ documentMetadataItems: response });
  }

  render() {
    const { classes } = this.props;
    return (
      <div className={classes.root}>
        <AppBar position="static" color="primary">
          <Toolbar>
            <Typography variant="h6" className={classes.title}>
              AWS Textract Document Processing
            </Typography>
            <Button className={classes.button} variant="contained" color="default" onClick={() => this.refreshDocumentMetadata()}>
              <RefreshIcon></RefreshIcon>Refresh
            </Button>
            <AmplifySignOut />
          </Toolbar>
        </AppBar>
        <Box my={1}>
          <Grid container spacing={1}>
            <Grid item xs={12} sm={4}>
              <Paper className={classes.paper}>
                <Typography variant="subtitle1">
                  File Upload Progress is {this.state.progress}% - {this.state.uploadState}
                </Typography>
                <Button className={classes.button} variant="contained" component="label">
                  {this.state.selectedFileName}
                  <input type="file" onChange={this.handleFileInput} hidden />
                </Button>
                <Button className={classes.button} variant="contained" color="primary" onClick={() => this.uploadFile(this.state.selectedFile)}>Upload to S3</Button>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Paper className={classes.paper}>
                <ReactJson src={this.state.documentMetadataItems} collapsed={2} enableClipboard={false} displayDataTypes={false} />
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </div>
    );
  }
}

export default withAuthenticator(withStyles(styles)(App));