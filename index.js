const isTarball = /.*\.tgz/;
const freaOrigin = "https://storage.googleapis.com/freajs";
const freaUrl = "https://registry.freajs.org";

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const pathname = new URL(request.url).pathname;

  // If this is a tarball serve from the mirrors otherwise serve from npm
  if (request.method === "GET" && isTarball.test(pathname)) {
    return handleTarball(pathname);
  }

  // Why don't we serve .json files from the mirrors today? We are still trying
  // to ensure the latency between when a package is uploaded to npm and when
  // it is served by frea is as minimal as possible. We have pretty good
  // guarentees (several seconds) though we would like to continue hardening
  // it before taking that GA

  const manifest = await fetch(`https://registry.npmjs.org${pathname}`);
  // If the resulting payload wasn't JSON or if this wasnt a get request there
  // isn't anything else to do
  if (
    request.method !== "GET" &&
    manifest.headers.get("Content-Type") !== "application/json"
  ) {
    return manifest;
  }

  // Resolve manifest's npm URLs to frea URLs
  return handleManifest(manifest);
}

async function handleTarball(pathname) {
  const tarball = await fetch(`${freaOrigin}${pathname}`);
  // If we didn't find it on frea let npm try to handle the request
  if (tarball.status !== 200) {
    console.log("served from npm");
    return fetch(`https://registry.npmjs.org${pathname}`);
  }
  console.log("served from frea");
  return tarball;
}

async function handleManifest(manifest) {
  const body = await manifest.json();
  const versions =
    typeof body.versions === "object" ? Object.values(body.versions) : [];
  versions.forEach(version => {
    if (
      !version.hasOwnProperty("dist") ||
      !version.dist.hasOwnProperty("tarball")
    ) {
      return;
    }
    const pathname = new URL(version.dist.tarball).pathname;
    version.dist.tarball = `${freaUrl}${pathname}`;
  });
  if (versions.length > 0) {
    body.versions = versions.reduce((a, v) => {
      a[v.version] = v;
      return a;
    }, {});
  }
  return new Response(JSON.stringify(body), manifest);
}
