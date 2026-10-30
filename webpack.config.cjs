const path = require("node:path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
module.exports = async () => ({
  mode: "production",
  entry: "./dist/client-ts/main.js",
  output: {
    path: path.resolve(__dirname, "dist/client"),
    filename: "app.js",
    clean: true,
  },
  resolve: {
    extensions: [".js"],
    modules: [path.resolve(__dirname, "node_modules")],
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        include: /node_modules[\\/]@angular[\\/]/,
        use: {
          loader: "babel-loader",
          options: {
            babelrc: false,
            configFile: false,
            plugins: [
              (await import("@angular/compiler-cli/linker/babel")).default,
            ],
          },
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({ ngDevMode: "false", ngJitMode: "false" }),
    new CopyPlugin({
      patterns: [
        { from: "client/index.html", to: "index.html" },
        { from: "dist/styles.css", to: "styles.css" },
      ],
    }),
  ],
  performance: { maxEntrypointSize: 1000000, maxAssetSize: 1000000 },
});
