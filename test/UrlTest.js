const test = require("ava");
const TemplateConfig = require("../src/TemplateConfig.js");
const url = require("../src/Filters/Url.js");

test("Test url filter passing in pathPrefix from config", (t) => {
  let eleventyConfig = new TemplateConfig();
  let pp = eleventyConfig.getConfig().pathPrefix;
  t.is(pp, "/");

  t.is(url("test", pp), "test");
  t.is(url("/test", pp), "/test");
});

test("Test url filter without passing in pathPrefix", (t) => {
  let eleventyConfig = new TemplateConfig();
  let urlFilter = eleventyConfig.userConfig.getFilter("url");

  t.is(urlFilter("test"), "test");
  t.is(urlFilter("/test"), "/test");
});

test("Test url filter with passthrough urls", (t) => {
  // via https://gist.github.com/mxpv/034933deeebb26b62f14
  t.is(url("http://foo.com/blah_blah", ""), "http://foo.com/blah_blah");
  t.is(url("http://foo.com/blah_blah/", ""), "http://foo.com/blah_blah/");
  t.is(
    url("http://foo.com/blah_blah_(wikipedia)", ""),
    "http://foo.com/blah_blah_(wikipedia)"
  );
  t.is(
    url("http://foo.com/blah_blah_(wikipedia)_(again)", ""),
    "http://foo.com/blah_blah_(wikipedia)_(again)"
  );
  t.is(
    url("http://www.example.com/wpstyle/?p=364", ""),
    "http://www.example.com/wpstyle/?p=364"
  );
  t.is(
    url("https://www.example.com/foo/?bar=baz&inga=42&quux", ""),
    "https://www.example.com/foo/?bar=baz&inga=42&quux"
  );
  t.is(
    url("http://userid:password@example.com:8080", ""),
    "http://userid:password@example.com:8080"
  );
  t.is(
    url("http://userid:password@example.com:8080/", ""),
    "http://userid:password@example.com:8080/"
  );
  t.is(url("http://userid@example.com", ""), "http://userid@example.com");
  t.is(url("http://userid@example.com/", ""), "http://userid@example.com/");
  t.is(
    url("http://userid@example.com:8080", ""),
    "http://userid@example.com:8080"
  );
  t.is(
    url("http://userid@example.com:8080/", ""),
    "http://userid@example.com:8080/"
  );
  t.is(
    url("http://userid:password@example.com", ""),
    "http://userid:password@example.com"
  );
  t.is(
    url("http://userid:password@example.com/", ""),
    "http://userid:password@example.com/"
  );
  t.is(url("http://142.42.1.1/", ""), "http://142.42.1.1/");
  t.is(url("http://142.42.1.1:8080/", ""), "http://142.42.1.1:8080/");
  t.is(
    url("http://foo.com/blah_(wikipedia)#cite-1", ""),
    "http://foo.com/blah_(wikipedia)#cite-1"
  );
  t.is(
    url("http://foo.com/blah_(wikipedia)_blah#cite-1", ""),
    "http://foo.com/blah_(wikipedia)_blah#cite-1"
  );
  t.is(
    url("http://foo.com/(something)?after=parens", ""),
    "http://foo.com/(something)?after=parens"
  );
  t.is(
    url("http://code.google.com/events/#&product=browser", ""),
    "http://code.google.com/events/#&product=browser"
  );
  t.is(url("http://j.mp", ""), "http://j.mp");
  t.is(url("ftp://foo.bar/baz", ""), "ftp://foo.bar/baz");
  t.is(
    url("http://foo.bar/?q=Test%20URL-encoded%20stuff", ""),
    "http://foo.bar/?q=Test%20URL-encoded%20stuff"
  );
  t.is(
    url("http://-.~_!$&'()*+,;=:%40:80%2f::::::@example.com", ""),
    "http://-.~_!$&'()*+,;=:%40:80%2f::::::@example.com"
  );
  t.is(url("http://1337.net", ""), "http://1337.net");
  t.is(url("http://a.b-c.de", ""), "http://a.b-c.de");
  t.is(url("http://223.255.255.254", ""), "http://223.255.255.254");

  // these tests were failing without the http/https bypass—upstream issues with valid-url
  t.is(url("http://✪df.ws/123", ""), "http://✪df.ws/123");
  t.is(url("http://➡.ws/䨹", ""), "http://➡.ws/䨹");
  t.is(url("http://⌘.ws", ""), "http://⌘.ws");
  t.is(url("http://⌘.ws/", ""), "http://⌘.ws/");
  t.is(
    url("http://foo.com/unicode_(✪)_in_parens", ""),
    "http://foo.com/unicode_(✪)_in_parens"
  );
  t.is(url("http://☺.damowmow.com/", ""), "http://☺.damowmow.com/");
  t.is(url("http://مثال.إختبار", ""), "http://مثال.إختبار");
  t.is(url("http://例子.测试", ""), "http://例子.测试");
  t.is(url("http://उदाहरण.परीक्षा", ""), "http://उदाहरण.परीक्षा");
});

test("Test url filter", (t) => {
  t.is(url("/", "/"), "/");
  t.is(url("//", "/"), "/");
  t.is(url(undefined, "/"), ".");
  t.is(url("", "/"), ".");

  // leave . and .. alone
  t.is(url(".", "/"), ".");
  t.is(url("./", "/"), "./");
  t.is(url("..", "/"), "..");
  t.is(url("../", "/"), "../");

  t.is(url("test", "/"), "test");
  t.is(url("/test", "/"), "/test");
  t.is(url("//test", "/"), "//test");
  t.is(url("./test", "/"), "test");
  t.is(url("../test", "/"), "../test");

  t.is(url("test/", "/"), "test/");
  t.is(url("/test/", "/"), "/test/");
  t.is(url("//test/", "/"), "//test/");
  t.is(url("./test/", "/"), "test/");
  t.is(url("../test/", "/"), "../test/");
});

test("Test url filter with custom pathPrefix (empty, gets overwritten by root config `/`)", (t) => {
  t.is(url("/", ""), "/");
  t.is(url("//", ""), "/");
  t.is(url(undefined, ""), ".");
  t.is(url("", ""), ".");

  // leave . and .. alone
  t.is(url(".", ""), ".");
  t.is(url("./", ""), "./");
  t.is(url("..", ""), "..");
  t.is(url("../", ""), "../");

  t.is(url("test", ""), "test");
  t.is(url("/test", ""), "/test");
  t.is(url("//test", ""), "//test");
  t.is(url("./test", ""), "test");
  t.is(url("../test", ""), "../test");

  t.is(url("test/", ""), "test/");
  t.is(url("/test/", ""), "/test/");
  t.is(url("//test/", ""), "//test/");
  t.is(url("./test/", ""), "test/");
  t.is(url("../test/", ""), "../test/");
});

test("Test url filter with custom pathPrefix (leading slash)", (t) => {
  t.is(url("/", "/testdir"), "/testdir/");
  t.is(url("//", "/testdir"), "/testdir/");
  t.is(url(undefined, "/testdir"), ".");
  t.is(url("", "/testdir"), ".");

  // leave . and .. alone
  t.is(url(".", "/testdir"), ".");
  t.is(url("./", "/testdir"), "./");
  t.is(url("..", "/testdir"), "..");
  t.is(url("../", "/testdir"), "../");

  t.is(url("test", "/testdir"), "test");
  t.is(url("/test", "/testdir"), "/testdir/test");
  t.is(url("//test", "/testdir"), "//test");
  t.is(url("./test", "/testdir"), "test");
  t.is(url("../test", "/testdir"), "../test");

  t.is(url("test/", "/testdir"), "test/");
  t.is(url("/test/", "/testdir"), "/testdir/test/");
  t.is(url("//test/", "/testdir"), "//test/");
  t.is(url("./test/", "/testdir"), "test/");
  t.is(url("../test/", "/testdir"), "../test/");
});

test("Test url filter with custom pathPrefix (double slash)", (t) => {
  t.is(url("/", "/testdir/"), "/testdir/");
  t.is(url("//", "/testdir/"), "/testdir/");
  t.is(url(undefined, "/testdir/"), ".");
  t.is(url("", "/testdir/"), ".");

  // leave . and .. alone
  t.is(url(".", "/testdir/"), ".");
  t.is(url("./", "/testdir/"), "./");
  t.is(url("..", "/testdir/"), "..");
  t.is(url("../", "/testdir/"), "../");

  t.is(url("test", "/testdir/"), "test");
  t.is(url("/test", "/testdir/"), "/testdir/test");
  t.is(url("//test", "/testdir/"), "//test");
  t.is(url("./test", "/testdir/"), "test");
  t.is(url("../test", "/testdir/"), "../test");

  t.is(url("test/", "/testdir/"), "test/");
  t.is(url("/test/", "/testdir/"), "/testdir/test/");
  t.is(url("//test/", "/testdir/"), "//test/");
  t.is(url("./test/", "/testdir/"), "test/");
  t.is(url("../test/", "/testdir/"), "../test/");
});

test("Test url filter with custom pathPrefix (trailing slash)", (t) => {
  t.is(url("/", "testdir/"), "/testdir/");
  t.is(url("//", "testdir/"), "/testdir/");
  t.is(url(undefined, "testdir/"), ".");
  t.is(url("", "testdir/"), ".");

  // leave . and .. alone
  t.is(url(".", "testdir/"), ".");
  t.is(url("./", "testdir/"), "./");
  t.is(url("..", "testdir/"), "..");
  t.is(url("../", "testdir/"), "../");

  t.is(url("test", "testdir/"), "test");
  t.is(url("/test", "testdir/"), "/testdir/test");
  t.is(url("//test", "testdir/"), "//test");
  t.is(url("./test", "testdir/"), "test");
  t.is(url("../test", "testdir/"), "../test");

  t.is(url("test/", "testdir/"), "test/");
  t.is(url("/test/", "testdir/"), "/testdir/test/");
  t.is(url("//test/", "testdir/"), "//test/");
  t.is(url("./test/", "testdir/"), "test/");
  t.is(url("../test/", "testdir/"), "../test/");
});

test("Test url filter with custom pathPrefix (no slash)", (t) => {
  t.is(url("/", "testdir"), "/testdir/");
  t.is(url("//", "testdir"), "/testdir/");
  t.is(url(undefined, "testdir"), ".");
  t.is(url("", "testdir"), ".");

  // leave . and .. alone
  t.is(url(".", "testdir"), ".");
  t.is(url("./", "testdir"), "./");
  t.is(url("..", "testdir"), "..");
  t.is(url("../", "testdir"), "../");

  t.is(url("test", "testdir"), "test");
  t.is(url("/test", "testdir"), "/testdir/test");
  t.is(url("//test", "testdir"), "//test");
  t.is(url("//foo.com", "testdir"), "//foo.com");
  t.is(url("./test", "testdir"), "test");
  t.is(url("../test", "testdir"), "../test");

  t.is(url("test/", "testdir"), "test/");
  t.is(url("/test/", "testdir"), "/testdir/test/");
  t.is(url("//test/", "testdir"), "//test/");
  t.is(url("./test/", "testdir"), "test/");
  t.is(url("../test/", "testdir"), "../test/");
});

test("Test url filter with custom pathPrefix (absolute url)", (t) => {
  t.is(url("test", "https://example.com"), "https://example.com/test");
  t.is(url("/test", "https://example.com"), "https://example.com/test");
  t.is(url("//test", "https://example.com"), "https://example.com/test");

  // plain http
  t.is(url("test", "http://example.com"), "http://example.com/test");
  t.is(url("/test", "http://example.com"), "http://example.com/test");
  t.is(url("//test", "http://example.com"), "http://example.com/test");
});

test("Test url filter with custom pathPrefix (absolute url with trailing slash)", (t) => {
  t.is(url("test", "https://example.com/"), "https://example.com/test");
  t.is(url("/test", "https://example.com/"), "https://example.com/test");
  t.is(url("//test", "https://example.com/"), "https://example.com/test");

  // plain http
  t.is(url("test", "http://example.com/"), "http://example.com/test");
  t.is(url("/test", "http://example.com/"), "http://example.com/test");
  t.is(url("//test", "http://example.com/"), "http://example.com/test");
});

test("Test url filter with custom pathPrefix (absolute url with path)", (t) => {
  t.is(
    url("test", "https://example.com/prefix"),
    "https://example.com/prefix/test"
  );
  t.is(
    url("/test", "https://example.com/prefix"),
    "https://example.com/prefix/test"
  );
  t.is(
    url("//test", "https://example.com/prefix"),
    "https://example.com/prefix/test"
  );

  // plain http
  t.is(
    url("test", "http://example.com/prefix"),
    "http://example.com/prefix/test"
  );
  t.is(
    url("/test", "http://example.com/prefix"),
    "http://example.com/prefix/test"
  );
  t.is(
    url("//test", "http://example.com/prefix"),
    "http://example.com/prefix/test"
  );
});
