import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Our Prisma client generates into src/generated/prisma instead of the
  // default node_modules/.prisma/client. Next.js's file tracing (which
  // decides what actually ships inside each Vercel serverless function)
  // doesn't know to follow Prisma's dynamic require() for its native query
  // engine binary in a non-default location, so without this the binary
  // gets left out of the deployed function — it works in every local build
  // (the file's just sitting on disk) but crashes on Vercel with nothing
  // useful in the browser, only in the function's own logs.
  outputFileTracingIncludes: {
    "/**": ["./src/generated/prisma/**/*"],
  },
  // Every photo upload (journal, workout, avatar) goes through a Server
  // Action taking a raw File in FormData — Next's default body-size cap for
  // those is 1MB, which a real phone photo blows past instantly, failing
  // the whole request before our own code (and its friendlier error
  // messages) ever runs. Raised to comfortably cover a full-res phone photo.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
