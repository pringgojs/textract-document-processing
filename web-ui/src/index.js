import React from 'react';
import ReactDOM from 'react-dom';
import { Amplify, Auth } from "aws-amplify";

import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import config from "./config.json";

Amplify.configure({
  Auth: {
    // REQUIRED - Amazon Cognito Region
    region: config.AMPLIFY.AUTH.REGION,

    // REQUIRED only for Federated Authentication - Amazon Cognito Identity Pool ID
    identityPoolId: config.AMPLIFY.AUTH.IDENTITY_POOL_ID,

    // OPTIONAL - Amazon Cognito User Pool ID
    userPoolId: config.AMPLIFY.AUTH.USER_POOL_ID,

    // OPTIONAL - Amazon Cognito Web Client ID (26-char alphanumeric string)
    userPoolWebClientId: config.AMPLIFY.AUTH.USER_POOL_WEB_CLIENT_ID
  },
  API: {
    endpoints: [
      {
          name: "DocumentMetadataService",
          endpoint: config.AMPLIFY.API.DOCUMENT_METADATA_SERVICE_ENDPOINT,
          custom_header: async () => { 
            return { Authorization: `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}` }
          }
      }
    ]
  }
});

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
