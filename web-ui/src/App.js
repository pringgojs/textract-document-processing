import React, { Component } from 'react';
import { withAuthenticator, AmplifySignOut } from '@aws-amplify/ui-react';
import { Auth } from 'aws-amplify';
import AWS from 'aws-sdk';
import { Button, Box, Container, Paper, Grid, Typography } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';

const styles = theme => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(1),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  }
});

const s3DocumentsBucketName ='textractdocumentprocessin-documentsbucket9ec9deb9-1bss6ew8q1fpy';
const s3DocumentsBucketRegion ='ap-southeast-1';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      progress: 0,
      selectedFile: null,
      uploadState: "Not Started"
    };
  }
  
  async componentDidMount() {
    try {
      let creds = await Auth.currentCredentials();
      console.log(creds);
      AWS.config.update({
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
        region: s3DocumentsBucketRegion
      });
    } catch (error) {
      console.log(error);
    }
  }

  render() {
    const handleFileInput = (e) => {
        this.setState({ selectedFile: e.target.files[0] });
    };

    const uploadFile = async (file) => {
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

    const { classes } = this.props;
    return (
      <React.Fragment>
        <Box>
          <AmplifySignOut />
        </Box>
        <Box my={4}>
          <div className={classes.root}>
            <Grid container spacing={1}>
              <Grid item xs={12} sm={4}>
                <Paper className={classes.paper}>
                  <Typography variant="subtitle1">
                    File Upload Progress is {this.state.progress}% - {this.state.uploadState}
                  </Typography>
                  <input type="file" onChange={handleFileInput}/>
                  <Button variant="contained" onClick={() => uploadFile(this.state.selectedFile)}>Upload to S3</Button>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Paper className={classes.paper}>

                </Paper>
              </Grid>
            </Grid>
          </div>
        </Box>
      </React.Fragment>
    );
  }
}

export default withAuthenticator(withStyles(styles)(App));