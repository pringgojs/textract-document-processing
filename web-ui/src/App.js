import React, { Component } from "react";
import { withAuthenticator, AmplifySignOut } from "@aws-amplify/ui-react";
import { Auth, API } from "aws-amplify";
import AWS from "aws-sdk";
import axios from "axios";
import Popup from "reactjs-popup";

import "reactjs-popup/dist/index.css";
import {
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Box,
  Paper,
  Grid,
  Typography,
  AppBar,
  Toolbar,
  Modal,
} from "@material-ui/core";
import RefreshIcon from "@material-ui/icons/Refresh";
import { withStyles, ThemeProvider } from "@material-ui/core/styles";
import ReactJson from "react-json-view";
import { createTheme } from "@material-ui/core/styles";

import config from "./config.json";

const styleModal = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 500,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

const red = {
  bgcolor: "red",
};

const styles = (theme) => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(1),
    "margin-bottom": theme.spacing(1),
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
      documentMetadataItems: [],
      modalOpen: false,
      detailDatabase: null,
      detailScan: null,
      tableBandingkan: [
        "NIB",
        "LUAS",
        "HAK",
        "DESA_KELURAHAN",
        "KECAMATAN",
        "KABUPATEN_KOTAMADYA",
      ],
    };
  }

  handleModalOpen = (scan) => {
    console.log(scan);
    this.setState({ detailScan: scan });
    this.getDataScanDetail(scan.NIB);
    this.setState({ modalOpen: true });

    console.log(scan);
  };

  handleModalClose = () => {
    this.setState({ modalOpen: false });
  };

  async getDataScanDetail(nib) {
    // console.log("componentWillMount");

    await axios
      .get("http://127.0.0.1:8000/api/scan-detail?nib=" + nib)
      .then((res) => {
        // console.log(res);
        this.setState({ detailDatabase: res.data });
        // return res.data;
      })
      .catch((err) => {
        console.log(err);
        // return err.data;
      });
    console.log(this.state.detailDatabase);
  }

  async componentDidMount() {
    try {
      let creds = await Auth.currentCredentials();
      AWS.config.update({
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
        region: s3DocumentsBucketRegion,
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

  bandingkan = () => {
    alert('Nilai "Luas" berbeda dengan data di database dengan NIB yang sama');
  };

  JsonDataDisplay = (JsonData) => {
    const DisplayData = JsonData.map((info) => {
      return (
        <tr>
          <td>{info.NIB}</td>
          <td>{info.KOTAK}</td>
          <td>{info.LUAS}</td>
          <td>{info.HAK}</td>
          <td>{info.DESA_KELURAHAN}</td>
          <td>{info.KECAMATAN}</td>
          <td>{info.KABUPATEN_KOTAMADYA}</td>
          <td>
            <Button
              onClick={() => this.handleModalOpen(info)}
              // onClick={(event) => this.handleModalOpen(event, info)}
              variant="contained"
            >
              Tampilkan
            </Button>
          </td>
        </tr>
      );
    });

    return (
      <div>
        <table>
          <thead>
            <tr>
              <th>NIB</th>
              <th>Kotak</th>
              <th>Luas</th>
              <th>Hak</th>
              <th>Desa/Kelurahan</th>
              <th>Kecamatan</th>
              <th>Kabupaten/Kotamadya</th>
              <th>Perbandingan</th>
            </tr>
          </thead>
          <tbody>{DisplayData}</tbody>
        </table>
      </div>
    );
  };

  uploadFile = async (file) => {
    if (file == null) {
      return;
    }

    var upload = new AWS.S3.ManagedUpload({
      params: {
        Body: file,
        Bucket: s3DocumentsBucketName,
        Key: file.name,
      },
    });

    try {
      await upload
        .on("httpUploadProgress", (evt) => {
          this.setState({
            progress: Math.round((evt.loaded / evt.total) * 100),
          });
        })
        .promise();
      this.setState({ uploadState: "Succeed" });
    } catch (e) {
      console.log(e);
      this.setState({ uploadState: "Failed" });
    }
  };

  getDocumentMetadata = () => {
    const apiName = "DocumentMetadataService";
    const path = "";
    const init = {
      headers: {},
    };

    return API.get(apiName, path, init);
  };

  refreshDocumentMetadata = async () => {
    const response = await this.getDocumentMetadata();
    this.setState({ documentMetadataItems: response });
  };

  render() {
    const { classes } = this.props;

    return (
      <div className={classes.root}>
        <ThemeProvider>
          <AppBar position="static" color="primary">
            <Toolbar>
              <Typography variant="h6" className={classes.title}>
                AWS Textract Document Processing
              </Typography>
              <Button
                className={classes.button}
                variant="contained"
                color="default"
                onClick={() => this.refreshDocumentMetadata()}
              >
                <RefreshIcon></RefreshIcon>Refresh Data
              </Button>
              <AmplifySignOut />
            </Toolbar>
          </AppBar>
          <Box my={1}>
            <Paper className={classes.paper}>
              <Typography variant="h6">Proses Dokumen</Typography>
              <Button
                className={classes.button}
                variant="contained"
                component="label"
              >
                {this.state.selectedFileName}
                <input type="file" onChange={this.handleFileInput} hidden />
              </Button>
              <Button
                className={classes.button}
                variant="contained"
                color="primary"
                onClick={() => this.uploadFile(this.state.selectedFile)}
              >
                Upload Dokumen
              </Button>
              <Typography variant="subtitle1">
                File Upload Progress is {this.state.progress}% -{" "}
                {this.state.uploadState}
              </Typography>
            </Paper>

            <Paper className={classes.paper}>
              <Typography variant="h4">
                Hasil Ekstraksi Dokumen Tanah
              </Typography>

              {this.JsonDataDisplay(this.state.documentMetadataItems)}
            </Paper>
          </Box>

          <Modal
            open={this.state.modalOpen}
            onClose={this.handleModalClose}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
          >
            <Box sx={styleModal}>
              <Typography id="modal-modal-title" variant="h6" component="h2">
                Tabel perbandingan data sertifikat tanah
              </Typography>

              <TableContainer component={Paper}>
                <Table sx={{ minWidth: 300 }} aria-label="simple table">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <b>DESKRIPSI</b>
                      </TableCell>
                      <TableCell align="left">
                        <b>HASIL UPLOAD</b>
                      </TableCell>
                      <TableCell align="left">
                        <b>DATABASE</b>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {this.state.tableBandingkan.map((header, index) => (
                      <TableRow>
                        <TableCell>
                          <b>{header.toUpperCase()}</b>
                        </TableCell>
                        <TableCell align="left">
                          {this.state.detailScan === null
                            ? null
                            : this.state.detailScan[header]}
                        </TableCell>

                        {this.state.detailScan && this.state.detailDatabase ? (
                          this.state.detailDatabase[header] !==
                          this.state.detailScan[header] ? (
                            <TableCell
                              align="left"
                              style={{ backgroundColor: "red" }}
                            >
                              {this.state.detailDatabase === null ? null : (
                                <div>{this.state.detailDatabase[header]}</div>
                              )}
                            </TableCell>
                          ) : (
                            <TableCell align="left">
                              {this.state.detailDatabase === null ? null : (
                                <div>{this.state.detailDatabase[header]}</div>
                              )}
                            </TableCell>
                          )
                        ) : (
                          ""
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Modal>
        </ThemeProvider>
      </div>
    );
  }
}

export default withAuthenticator(withStyles(styles)(App));
