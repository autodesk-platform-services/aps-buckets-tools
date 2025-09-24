'use strict'; // http://www.w3schools.com/js/js_strict.asp

// web framework
var express = require('express');
var router = express.Router();

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

var sdk = require('@aps_sdk/autodesk-sdkmanager');
var derivativeSdk = require('@aps_sdk/model-derivative');
const config = require('./config');
const sdkManager = sdk.SdkManagerBuilder.create().build();
const modelDerivativeClient = new derivativeSdk.ModelDerivativeClient(sdkManager);

if (config.regions === null) {
    config.regions = [];
    const keys = Object.keys(derivativeSdk.Region);
    for (let key of keys) {
        config.regions.push(derivativeSdk.Region[key]);
    }
}

/////////////////////////////////////////////////////////////////
// Get the list of export file formats supported by the
// Model Derivative API
/////////////////////////////////////////////////////////////////
router.get('/formats', function (req, res) {
    modelDerivativeClient.getFormats({ accessToken: req.session.access_token })
        .then(function (formats) {
            res.json(formats);
        })
        .catch(function (error) {
            res.status(error?.response?.status || 500).end(error?.message || "Failed");
        });
});

/////////////////////////////////////////////////////////////////
// Get the manifest of the given file. This will contain
// information about the various formats which are currently
// available for this file
/////////////////////////////////////////////////////////////////
router.get('/manifests/:urn', function (req, res) {
    // not used yet: you can reach the manifest stored in EMEA even if you 
    // ask for it using the US endpoint 
    var region = req.query.region;


    modelDerivativeClient.getManifest(req.params.urn, { region: region, accessToken: req.session.access_token })
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error?.response?.status || 500).end(error?.message || "Failed");
        });
});

router.delete('/manifests/:urn', function (req, res) {
    try {
        modelDerivativeClient.deleteManifest(req.params.urn, { region: req.query.region, accessToken: req.session.access_token })
            .then(function (data) {
                res.json(data);
            })
            .catch(function (error) {
                res.status(error?.response?.status || 500).end(error?.message || "Failed");
            });

    } catch (err) {
        res.status(500).end(err.message);
    }
});

/////////////////////////////////////////////////////////////////
// Get the metadata of the given file. This will provide us with
// the guid of the avilable models in the file
/////////////////////////////////////////////////////////////////
router.get('/metadatas/:urn', function (req, res) {
    var region = req.query.region;

    modelDerivativeClient.getModelViews(req.params.urn, { region: region, accessToken: req.session.access_token })
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error?.response?.status || 500).end(error?.message || "Failed");
        });
});

/////////////////////////////////////////////////////////////////
// Get the hierarchy information for the model with the given
// guid inside the file with the provided urn
/////////////////////////////////////////////////////////////////
router.get('/hierarchy', function (req, res) {
    modelDerivativeClient.getObjectTree(req.query.urn, req.query.guid, { region: req.query.region, accessToken: req.session.access_token })
        .then(function (metaData) {
            if (metaData.data) {
                res.json(metaData);
            } else {
                res.json({ result: 'accepted' });
            }
        })
        .catch(function (error) {
            res.status(error.response.status || 500).end(error?.message || "Failed");
        });
});

/////////////////////////////////////////////////////////////////
// Get the properties for all the components inside the model
// with the given guid and file urn
/////////////////////////////////////////////////////////////////
router.get('/properties', function (req, res) {
    modelDerivativeClient.getAllProperties(req.query.urn, req.query.guid, { region: req.query.region, accessToken: req.session.access_token })
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error?.response?.status || 500).end(error?.message || "Failed");
        });
});

/////////////////////////////////////////////////////////////////
// Download the given derivative file, e.g. a STEP or other
// file format which are associated with the model file
/////////////////////////////////////////////////////////////////
router.get('/download', function (req, res) {
    modelDerivativeClient.getDerivativeUrl(req.query.derUrn, req.query.urn, { region: req.query.region, accessToken: req.session.access_token })
        .then(function (data) {
            res.redirect(data.url);
        })
        .catch(function (error) {
            res.status(error?.response?.status || 500).end(error?.message || "Failed");
        });
});

/////////////////////////////////////////////////////////////////
// Send a translation request in order to get an SVF or other
// file format for our file
/////////////////////////////////////////////////////////////////

router.post('/export', jsonParser, function (req, res) {
    //env, token, urn, format, rootFileName, fileExtType, advanced   
    const { format, urn, region, fileExtType, rootFileName, advanced } = req.body;

    // Initialize the item with format type
    let item = { type: format };

    // Add views for SVF format
    if (format.startsWith('svf')) {
        item.views = ['2d', '3d'];
    }

    // Add advanced options if present
    if (advanced) {
        item.advanced = advanced;
    }

    // Modify advanced options based on file extension type
    // 20.07.2024 - Updated advanced options will be used in the translation job for DWG, DXF, RVT for 2D views to be generated as PDFs.
    //ref:https://aps.autodesk.com/blog/advanced-option-rvtdwg-2d-views-svf2-post-job
    switch (fileExtType) {
        case 'ifc':
            item.advanced = { ...item.advanced, conversionMethod: 'modern' };
			item.advanced.conversionMethod = advanced?.conversionMethod || 'modern';
            break;
        case 'dwg':
        case 'dxf':
        case 'rvt':
            item.advanced = { ...item.advanced, "2dviews": "pdf" };
			item.advanced["2dviews"] = advanced?.["2dviews"] || "pdf";
            break;
        case 'zip':
            if (rootFileName.endsWith('.dwg')
                || rootFileName.endsWith('.dxf')
                || rootFileName.endsWith('.rvt')) {
                item.advanced = { "2dviews": "pdf" };
            }
            break;
        // Add more cases as needed here
        default:
            break;
    }

    // Define input based on file extension type
    const input = fileExtType === 'zip'
        ? { urn, rootFilename: rootFileName, compressedUrn: true }
        : { urn };

    // Define output with destination region and formats
    const output = {
        formats: [item]
    };

    modelDerivativeClient.startJob({ "input": input, "output": output }, { region, accessToken: req.session.access_token })
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error?.response?.status || 500).end(error?.message || "Failed");
        });
});



/////////////////////////////////////////////////////////////////
// Return the router object that contains the endpoints
/////////////////////////////////////////////////////////////////
module.exports = router;