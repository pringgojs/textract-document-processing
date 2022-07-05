import React, { Component } from "react";
import { withAuthenticator, AmplifySignOut } from "@aws-amplify/ui-react";
import { Auth, API } from "aws-amplify";
import AWS from "aws-sdk";
import axios from "axios";
import logo from "./logo.png";

import "reactjs-popup/dist/index.css";
import {
  Backdrop,
  Fade,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Box,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Modal,
} from "@material-ui/core";
import RefreshIcon from "@material-ui/icons/Refresh";
import { withStyles, ThemeProvider } from "@material-ui/core/styles";
import config from "./config.json";

const styles = (theme) => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(1),
    "margin-bottom": theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  paperModal: {
    backgroundColor: theme.palette.background.paper,
    border: "2px solid #000",
    boxShadow: theme.shadows[5],
    padding: theme.spacing(2, 4, 3),
    maxWidth: 800,
  },
  button: {
    margin: theme.spacing(1),
  },
  title: {
    flexGrow: 1,
    marginLeft: "10px",
  },
  modal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  table: {
    minWidth: 650,
  },
  logo: {
    width: "5%",
  },
  subTitle: { flex: "1 1 100%", color: "black" },
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

      headers: [
        "#",
        "NIB",
        "KOTAK",
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

  JsonDataDisplay = (JsonData) => {
    const { classes } = this.props;

    const DisplayData = JsonData.map((info) => {
      return (
        <TableRow>
          {this.state.headers.map((header, index) =>
            header !== "#" ? (
              <TableCell>{info[header]}</TableCell>
            ) : (
              <TableCell>
                <Button
                  onClick={() => this.handleModalOpen(info)}
                  variant="contained"
                >
                  Tampilkan
                </Button>
              </TableCell>
            )
          )}
        </TableRow>
      );
    });

    return (
      <div>
        <TableContainer component={Paper}>
          <Table className={classes.table} aria-label="simple table">
            <TableHead>
              <TableRow>
                {this.state.headers.map((header, index) => (
                  <TableCell>{header.replace("_", "/")}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>{DisplayData}</TableBody>
          </Table>
        </TableContainer>
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
              <img src={logo} className={classes.logo} alt="logo" />

              <Typography variant="h6" className={classes.title}>
                BADAN PERTANAHAN NASIONAL
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
              <Typography variant="h6" className={classes.subTitle}>
                PROSES DOKUMEN
              </Typography>
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
                Unggah Dokumen
              </Button>
              <Typography variant="subtitle1">
                File Upload Progress is {this.state.progress}% -{" "}
                {this.state.uploadState}
              </Typography>
            </Paper>

            <Paper className={classes.paper}>
              <Typography variant="h6" className={classes.subTitle}>
                HASIL EKSTRAKSI DOKUMEN TANAH
              </Typography>
              {this.JsonDataDisplay(this.state.documentMetadataItems)}
            </Paper>
          </Box>

          {/* Modal */}
          <Modal
            aria-labelledby="transition-modal-title"
            aria-describedby="transition-modal-description"
            className={classes.modal}
            open={this.state.modalOpen}
            onClose={this.handleModalClose}
            closeAfterTransition
            BackdropComponent={Backdrop}
            BackdropProps={{
              timeout: 500,
            }}
          >
            <Fade in={this.state.modalOpen}>
              <div className={classes.paperModal}>
                <h2 id="transition-modal-title">
                  PERBANDINGAN DATA HASIL UNGGAH DENGAN DATA YANG ADA DI
                  DATABASE DENGAN NIB YANG SAMA
                </h2>
                <TableContainer component={Paper}>
                  <Table sx={{ minWidth: 300 }} aria-label="simple table">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <b>DESKRIPSI</b>
                        </TableCell>
                        <TableCell align="left">
                          <b>HASIL UNGGAH</b>
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
                            <b>{header.toUpperCase().replace("_", "/")}</b>
                          </TableCell>
                          <TableCell align="left">
                            {this.state.detailScan === null
                              ? null
                              : this.state.detailScan[header]}
                          </TableCell>

                          {this.state.detailScan &&
                          this.state.detailDatabase ? (
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
              </div>
            </Fade>
          </Modal>
        </ThemeProvider>
      </div>
    );
  }
}

export default withAuthenticator(withStyles(styles)(App));
