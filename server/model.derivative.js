'use strict'; // http://www.w3schools.com/js/js_strict.asp

// web framework
var express = require('express');
var router = express.Router();

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

var apsSDK = require('forge-apis');

/////////////////////////////////////////////////////////////////
// Get the list of export file formats supported by the
// Model Derivative API
/////////////////////////////////////////////////////////////////
router.get('/formats', function (req, res) {
    var derivatives = new apsSDK.DerivativesApi();

    derivatives.getFormats({}, null, req.session)
        .then(function (formats) {
            res.json(formats.body);
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
    var derivatives = new apsSDK.DerivativesApi();

    // not used yet: you can reach the manifest stored in EMEA even if you 
    // ask for it using the US endpoint 
    var region = req.query.region;



    derivatives.getManifest(req.params.urn, {}, null, req.session)
        .then(function (data) {
            res.json(data.body);
        })
        .catch(function (error) {
            res.status(error?.response?.status || 500).end(error?.message || "Failed");
        });
});

router.delete('/manifests/:urn', function (req, res) {


    var derivatives = new apsSDK.DerivativesApi();
    try {
        derivatives.deleteManifest(req.params.urn, null, req.session)
            .then(function (data) {
                res.json(data.body);
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
    var derivatives = new apsSDK.DerivativesApi();



    derivatives.getMetadata(req.params.urn, {}, null, req.session)
        .then(function (data) {
            res.json(data.body);
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
    var derivatives = new apsSDK.DerivativesApi();

    derivatives.getModelviewMetadata(req.query.urn, req.query.guid, {}, null, req.session)
        .then(function (metaData) {
            if (metaData.body.data) {
                res.json(metaData.body);
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
    var derivatives = new apsSDK.DerivativesApi();

    derivatives.getModelviewProperties(req.query.urn, req.query.guid, {}, null, req.session)
        .then(function (data) {
            res.json(data.body);
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
    var derivatives = new apsSDK.DerivativesApi();

    derivatives.getDerivativeManifest(req.query.urn, req.query.derUrn, {}, null, req.session)
        .then(function (data) {
            var fileParts = req.query.fileName.split('.')
            var fileExt = fileParts[fileParts.length - 1];
            res.set('content-type', 'application/octet-stream');
            res.set('Content-Disposition', 'attachment; filename="' + req.query.fileName + '"');
            res.end(data.body);
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
            break;
        case 'dwg':
        case 'dxf':
        case 'rvt':
            item.advanced = { ...item.advanced, "2dviews": "pdf" };
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
        destination: { region },
        formats: [item]
    };

    // Initialize the derivatives API
    const derivatives = new apsSDK.DerivativesApi();

    if (!derivatives) {
        throw new Error('Failed to initialize Derivatives API');
    }


    derivatives.translate({ "input": input, "output": output }, {}, null, req.session)
        .then(function (data) {
            res.json(data.body);
        })
        .catch(function (error) {
            res.status(error?.response?.status || 500).end(error?.message || "Failed");
        });
});



/////////////////////////////////////////////////////////////////
// Return the router object that contains the endpoints
/////////////////////////////////////////////////////////////////
module.exports = router;