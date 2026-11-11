import type { NextConfig } from 'next';

const config: NextConfig = {
  // Some messaging apps read only the document head and use a generic user agent.
  htmlLimitedBots: /.*/,
};

export default config;
