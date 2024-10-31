const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const WorkboxPlugin = require('workbox-webpack-plugin');

module.exports = {
  entry: {
    popup: './src/popup.jsx',
    background: './src/background.js',
    content: './src/content.js',
    offscreen: './src/offscreen.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: './src/offscreen.html',
      filename: 'offscreen.html',
      chunks: ['offscreen'],
    }),
    new CopyPlugin({
      patterns: [
        { from: "src/assets", to: "assets" },
        { from: "manifest.json", to: "." },
      ],
    }),
    new Dotenv(),
    new WorkboxPlugin.InjectManifest({
      swSrc: './public/service-worker.js',
      swDest: 'service-worker.js',
      additionalManifestEntries: [
        { url: '/logo192.png', revision: null },
        { url: '/logo512.png', revision: null }
      ]
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  devtool: 'source-map',
};