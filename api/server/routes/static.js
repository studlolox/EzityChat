const express = require('express');
const { isEnabled, createThumbnailHandler } = require('@librechat/api');
const staticCache = require('../utils/staticCache');
const paths = require('~/config/paths');

const skipGzipScan = !isEnabled(process.env.ENABLE_IMAGE_OUTPUT_GZIP_SCAN);

const router = express.Router();
router.use(createThumbnailHandler({ imageOutputDir: paths.imageOutput }));
router.use(staticCache(paths.imageOutput, { skipGzipScan }));

module.exports = router;
