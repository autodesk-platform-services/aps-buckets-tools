/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Autodesk Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

'use strict'; // http://www.w3schools.com/js/js_strict.asp

// token handling in session
var token = require('./token');

// web framework
var express = require('express');
var router = express.Router();

var apsSDK = require('forge-apis');

router.use(express.json());

// this end point will logoff the user by destroying the session
// as of now there is no endpoint to invalidate tokens
router.get('/logoff', function (req, res) {
    req.session.destroy();
    res.end('/');
});

router.get('/token', async function (req, res) {
  try {
    const tokenSession = new token(req.session);

    const req = new apsSDK.AuthClientTwoLeggedV2(client_id, client_secret, ["viewables:read"]);
    const credentials = await req.authenticate();

    res.json({ token: credentials.access_token, expires_in: credentials.expires_in });
  } catch (err) {
    res.end(err);
  }
});

router.post('/credentials', async function (req, res) {
    var tokenSession = new token(req.session);

    try {
      var client_id = req.body.client_id;
      var client_secret = req.body.client_secret;
      var scopes = req.body.scopes;
      scopes = scopes.split(' ')

      var req = new apsSDK.AuthClientTwoLeggedV2(client_id, client_secret, scopes);
      await req.authenticate();

      tokenSession.setCredentials(req);
      tokenSession.setScopes(scopes);
      tokenSession.setClientID(client_id);
      tokenSession.setClientSecret(client_secret);
          
      res.end();
    } catch (err) {
        res.status(500).end(err);
    }
});

module.exports = router;