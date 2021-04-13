import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import Amplify from "aws-amplify";

Amplify.configure({
  Auth: {
      // REQUIRED - Amazon Cognito Region
      region: 'ap-southeast-1',

      // REQUIRED only for Federated Authentication - Amazon Cognito Identity Pool ID
      identityPoolId: 'ap-southeast-1:e6f73938-bf63-47f7-92f7-aba25631ce92',

      // OPTIONAL - Amazon Cognito User Pool ID
      userPoolId: 'ap-southeast-1_EaNaTlyw8',

      // OPTIONAL - Amazon Cognito Web Client ID (26-char alphanumeric string)
      userPoolWebClientId: '66eqvlvgcv5k2nb6q2uis54cop'
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
