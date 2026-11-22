(function () {
  var root = typeof globalThis !== "undefined" ? globalThis : this;

  var constants = {
    browserTarget: "firefox",
    twitchApi: {
      api: "https://id.twitch.tv/oauth2/authorize",
      response_type: "token",
      client_id: "nhrhocc8g5gfm8w98oi9ozuuo4ser2",
      client_secret: "",
      scope: "user:read:follows user:read:email",
      redirect_uri: "https://ndragomirov.github.io/twitch-firefox.html"
    }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = constants;
  }
  root.constants = constants;
})();
