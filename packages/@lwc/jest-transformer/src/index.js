/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
const path = require('path');
const crypto = require('crypto');

const { isKnownScopedCssFile } = require('@lwc/jest-shared');

const babelCore = require('@babel/core');
const lwcCompiler = require('@lwc/compiler');
const jestPreset = require('babel-preset-jest');
const babelCommonJs = require('@babel/plugin-transform-modules-commonjs');
const babelDynamicImport = require('@babel/plugin-proposal-dynamic-import');
const babelClassProperties = require('@babel/plugin-syntax-class-properties');
const babelSyntaxDecorators = require('@babel/plugin-syntax-decorators');
const babelTsPreset = require.resolve('@babel/preset-typescript');

const compilerVersion = require('@lwc/compiler/package.json').version;

const apexScopedImport = require('./transforms/apex-scoped-import');
const apexContinuationScopedImport = require('./transforms/apex-continuation-scoped-import');
const customPermissionImport = require('./transforms/custom-permission-scoped-import');
const i18nScopedImport = require('./transforms/i18n-scoped-import');
const labelScopedImport = require('./transforms/label-scoped-import');
const resourceScopedImport = require('./transforms/resource-scoped-import');
const contentAssetUrlScopedImport = require('./transforms/content-asset-url-scoped-import');
const schemaScopedImport = require('./transforms/schema-scoped-import');
const userScopedImport = require('./transforms/user-scoped-import');
const userPermissionImport = require('./transforms/user-permission-scoped-import');
const clientScopedImport = require('./transforms/client-scoped-import');
const messageChannelScopedImport = require('./transforms/message-channel-scoped-import');
const accessCheck = require('./transforms/access-check-scoped-import');
const siteScopedImport = require('./transforms/site-scoped-import');

const BABEL_TS_CONFIG = {
    sourceMaps: 'inline',
    babelrc: false,
    configFile: false,
    plugins: [
        babelClassProperties,
        [
            babelSyntaxDecorators,
            {
                decoratorsBeforeExport: true,
            },
        ],
    ],
    presets: [[babelTsPreset, { allowDeclareFields: true }]],
};

const BABEL_CONFIG = {
    sourceMaps: 'both',
    presets: [jestPreset],
    plugins: [
        babelDynamicImport,
        babelCommonJs,
        apexScopedImport,
        apexContinuationScopedImport,
        customPermissionImport,
        i18nScopedImport,
        labelScopedImport,
        contentAssetUrlScopedImport,
        resourceScopedImport,
        schemaScopedImport,
        userScopedImport,
        userPermissionImport,
        clientScopedImport,
        messageChannelScopedImport,
        accessCheck,
        siteScopedImport,
    ],
};

function isTypeScript(filePath) {
    return path.extname(filePath) === '.ts';
}

function transformTypeScript(src, filePath) {
    const { code } = babelCore.transform(src, {
        ...BABEL_TS_CONFIG,
        filename: filePath,
    });
    return code;
}

module.exports = {
    process(src, filePath) {
        if (isTypeScript(filePath)) {
            src = transformTypeScript(src, filePath);
        }

        // Set default module name and namespace value for the namespace because it can't be properly guessed from the path
        const { code, map } = lwcCompiler.transformSync(src, filePath, {
            name: 'test',
            namespace: 'x',
            outputConfig: {
                sourcemap: true,
            },
            experimentalDynamicComponent: {
                strictSpecifier: false,
            },
            scopedStyles: isKnownScopedCssFile(filePath),
            enableLwcSpread: true,
            enableDynamicComponents: true,
        });

        // if is not .js, we add the .compiled extension in the sourcemap
        const filename = path.extname(filePath) === '.js' ? filePath : filePath + '.compiled';
        // **Note: .html and .css don't return valid sourcemaps cause they are used for rollup
        const config = map && map.version ? { inputSourceMap: map } : {};

        return babelCore.transform(code, { ...BABEL_CONFIG, ...config, filename });
    },

    getCacheKey(sourceText, sourcePath, ...rest) {
        let configString;
        let transformConfig;

        if (rest.length === 1) {
            // Handle jest@27 arguments
            // type getCacheKey = (sourceText: string, sourcePath: string, options: { configString: string }) => string;
            transformConfig = rest[0];
            configString = transformConfig.configString;
        } else if (rest.length === 2) {
            // Handle jest@26 arguments
            // type getCacheKey = (sourceText: string, sourcePath: string, configStr: string, options: any) => string;
            configString = rest[0];
            transformConfig = rest[1];
        } else {
            throw new Error('Unexpected transform arguments.');
        }

        const { NODE_ENV } = process.env;

        return crypto
            .createHash('md5')
            .update(JSON.stringify(configString), 'utf8')
            .update(sourceText + sourcePath + configString + NODE_ENV + compilerVersion, 'utf8')
            .digest('hex');
    },
};
