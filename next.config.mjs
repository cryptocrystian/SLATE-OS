/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Phase 1B Sprint 4D-C — Client Report Link route.
        // No-store across the board (allowed and blocked variants
        // alike) so intermediaries never cache either state. The
        // `noindex,nofollow` directive also lands in the page's
        // generateMetadata; the response header here is the
        // belt-and-suspenders pair.
        source: "/r/:token*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
