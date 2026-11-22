export default [
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "dist/**",
      "common/dist/**",
      "common/lib/3rd/**"
    ]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        self: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        console: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Audio: "readonly",
        FileReader: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        chrome: "readonly",
        browser: "readonly",
        jQuery: "readonly",
        $: "readonly",
        _: "readonly",
        Backbone: "readonly",
        Handlebars: "readonly",
        utils: "readonly",
        constants: "readonly",
        contributorList: "readonly",
        bgBridge: "readonly",
        i18n: "readonly",
        baron: "readonly",
        humaneDate: "readonly",
        app: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "args": "none", "caughtErrors": "none" }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "eqeqeq": ["warn", "smart"]
    }
  }
];
