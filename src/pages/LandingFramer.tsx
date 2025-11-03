import React from 'react';

const LandingFramer: React.FC = () => {
  return (
    <div dangerouslySetInnerHTML={{ __html: `
    <!doctype html>
    <!-- ✨ Built with Framer • https://www.framer.com/ -->
    <html lang="en">
    <head>
        <meta charset="utf-8">
        
        
        <script>try{if(localStorage.get("__framer_force_showing_editorbar_since")){const n=document.createElement("link");n.rel = "modulepreload";n.href="https://framer.com/edit/init.mjs";document.head.appendChild(n)}}catch(e){}</script>
        <!-- Start of headStart -->
        
        <!-- End of headStart -->
        <meta name="viewport" content="width=device-width">
        <meta name="generator" content="Framer 5e8f756">
        <title>Lunera - Framer Template</title>
        <meta name="description" content="Lunera is a modern SaaS landing page template designed for startups ready to scale. With clean design, flexible sections, and powerful features, it helps you launch fast and grow effortlessly.">
        <meta name="framer-search-index" content="https://framerusercontent.com/sites/6RYn4qEDUmkmQEgNnzEfM6/searchIndex-3XtpEdHaFoB6.json">
        <meta name="framer-search-index-fallback" content="https://framerusercontent.com/sites/6RYn4qEDUmkmQEgNnzEfM6/searchIndex-VVkF4VPVfjkZ.json">
        <link href="https://framerusercontent.com/images/cVGjz6AJ2PV4PDKrA9WhbhbeE.png" rel="icon" media="(prefers-color-scheme: light)">
        <link href="https://framerusercontent.com/images/cVGjz6AJ2PV4PDKrA9WhbhbeE.png" rel="icon" media="(prefers-color-scheme: dark)">
        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website">
        <meta property="og:title" content="Lunera - Framer Template">
        <meta property="og:description" content="Lunera is a modern SaaS landing page template designed for startups ready to scale. With clean design, flexible sections, and powerful features, it helps you launch fast and grow effortlessly.">
        <meta property="og:image" content="https://framerusercontent.com/images/fv3k8xm0FfJ58vzyWGm1WzNwfQ.png">
        <!-- Twitter -->
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="Lunera - Framer Template">
        <meta name="twitter:description" content="Lunera is a modern SaaS landing page template designed for startups ready to scale. With clean design, flexible sections, and powerful features, it helps you launch fast and grow effortlessly.">
        <meta name="twitter:image" content="https://framerusercontent.com/images/fv3k8xm0FfJ58vzyWGm1WzNwfQ.png">
        
        <style data-framer-font-css>/* cyrillic-ext */
    @font-face {
      font-family: 'Inter Tight';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjPQ-aVi5SkK8.woff2) format('woff2');
      unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
    }
    /* cyrillic */
    @font-face {
      font-family: 'Inter Tight';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjPQ-aXy5SkK8.woff2) format('woff2');
      unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
    }
    /* greek-ext */
    @font-face {
      font-family: 'Inter Tight';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjPQ-aVy5SkK8.woff2) format('woff2');
      unicode-range: U+1F00-1FFF;
    }
    /* greek */
    @font-face {
      font-family: 'Inter Tight';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjPQ-aWC5SkK8.woff2) format('woff2');
      unicode-range: U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF;
    }
    /* vietnamese */
    @font-face {
      font-family: 'Inter Tight';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjPQ-aVC5SkK8.woff2) format('woff2');
      unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
    }
    /* latin-ext */
    @font-face {
      font-family: 'Inter Tight';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjPQ-aVS5SkK8.woff2) format('woff2');
      unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
    /* latin */
    @font-face {
      font-family: 'Inter Tight';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjPQ-aWy5S.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    /* cyrillic-ext */
    @font-face {
      font-family: 'Fragment Mono';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/fragmentmono/v6/4iCr6K5wfMRRjxp0DA6-2CLnB45HhrUI.woff2) format('woff2');
      unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
    }
    /* latin-ext */
    @font-face {
      font-family: 'Fragment Mono';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/fragmentmono/v6/4iCr6K5wfMRRjxp0DA6-2CLnB41HhrUI.woff2) format('woff2');
      unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
    /* latin */
    @font-face {
      font-family: 'Fragment Mono';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/fragmentmono/v6/4iCr6K5wfMRRjxp0DA6-2CLnB4NHhg.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/ePuN3mCjzajIHnyCdvKBFiZkyY0.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/V3j1L0o5vPFKe26Sw4HcpXCfHo.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/F3kdpd2N0cToWV5huaZjjgM.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/0iDmxkizU9goZoclqIqsV5rvETU.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/r0mv3NegmA0akcQsNFotG32Las.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/iwWTDc49ENF2tCHbqlNARXw6Ug.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/Ii21jnSJkulBKsHHXKlapi7fv9w.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/5vvr9Vy74if2I6bQbJvbw7SY1pQ.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/EOr0mi4hNtlgWNn9if640EZzXCo.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/Y9k9QrlZAqio88Klkmbd8VoMQc.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/OYrD2tBIBPvoJXiIHnLoOXnY9M.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/JeYwfuaPfZHQhEG8U5gtPDZ7WQ.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/GrgcKwrN6d3Uz8EwcLHZxwEfC4.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/b6Y37FthZeALduNqHicBT6FutY.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/2uIBiALfCHVpWbHqRMZutfT7giU.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/Zwfz6xbVe5pmcWRJRgBDHnMkOkI.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/U9LaDDmbRhzX3sB8g8glTy5feTE.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/tVew2LzXJ1t7QfxP1gdTIdj2o0g.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/DF7bjCRmStYPqSb945lAlMfCCVQ.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/bHYNJqzTyl2lqvmMiRRS6Y16Es.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/vebZUMjGyKkYsfcY73iwWTzLNag.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/vQyevYAyHtARFwPqUzQGpnDs.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/I11LrmuBDQZweplJ62KkVsklU5Y.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/UjFZPDy3qGuDktQM4q9CxhKfIa8.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/8exwVHJy2DhJ4N5prYlVMrEKmQ.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/UTeedEK21hO5jDxEUldzdScUqpg.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/Ig8B8nzy11hzIWEIYnkg91sofjo.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/qITWJ2WdG0wrgQPDb8lvnYnTXDg.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/qctQFoJqJ9aIbRSIp0AhCQpFxn8.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/fXvVh2JeZlehNcEhKHpHH0frSl0.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/7pScaNeb6M7n2HF2jKemDqzCIr4.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/qS4UjQYyATcVV9rODk0Zx9KhkY8.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/VfD2n20yM7v0hrUEBHEyafsmMBY.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/4oIO9fB59bn3cKFWz7piCj28z9s.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/MzumQQZJQBC6KM1omtmwOtsogtI.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/F5Lmfd3fCAu7TwiYbI4DLWw4ks.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/THWAFHoAcmqLMy81E8hCSdziVKA.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/sQxGYWDlRkDr0eOKqiNRl6g5rs.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/NNTAT1XAm8ZRkr824inYPkjNeL4.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/P2qr9PAWBt905929rHfxmneMUG0.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/2BmSa4TZZvFKAZg2DydxTbvKlTU.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/2BmSa4TZZvFKAZg2DydxTbvKlTU.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/KMFW46iYsEZaUBwXbwPc9nQm71o.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/8yoV9pUxquX7VD7ZXlNYKQmkmk.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/n9CXKI3tsmCPeC6MCT9NziShSuQ.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/TBccIZR9kIpkRce5i9ATfPp7a4.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/A5P4nkYCJlLQxGxaS1lzG8PNSc.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/vuPfygr1n1zYxscvWgGI8hRf3LE.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/jplzYzqFHXreyADwk9yrkQlWQ.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/sSIKP2TfVPvfK7YVENPE5H87A.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/gawbeo7iEJSRZ4kcrh6YRrU8o.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/xSzma7KIWAdctStaX171ey3lams.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/8E92vrr3j1gDqzepmeSbD2u0JxA.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/5A3Ce6C9YYmCjpQx9M4inSaKU.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/Qx95Xyt0Ka3SGhinnbXIGpEIyP4.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/6mJuEAguuIuMog10gGvH5d3cl8.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/xYYWaj7wCU5zSQH0eXvSaS19wo.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/otTaNuNpVK4RbdlT7zDDdKvQBA.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/d3tHnaQIAeqiE5hGcRw4mmgWYU.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/DolVirEGb34pEXEp8t8FQBSK4.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/DpPBYI0sL4fYLgAkX8KXOPVt7c.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/4RAEQdEOrcnDkhHiiCbJOw92Lk.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/1K3W8DizY3v4emK8Mb08YHxTbs.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/tUSCtfYVM1I1IchuyCwz9gDdQ.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/VgYFWiwsAC5OYxAycRXXvhze58.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/DXD0Q7LSl7HEvDzucnyLnGBHM.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/GIryZETIX4IFypco5pYZONKhJIo.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/H89BbHkbHDzlxZzxi8uPzTsp90.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/u6gJwDuwB143kpNK1T1MDKDWkMc.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/43sJ6MfOPh1LCJt46OvyDuSbA6o.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/wccHG0r4gBDAIRhfHiOlq6oEkqw.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/WZ367JPwf9bRW6LdTHN8rXgSjw.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/QxmhnWTzLtyjIiZcfaLIJ8EFBXU.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/2A4Xx7CngadFGlVV4xrO06OBHY.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/khkJkwSL66WFg8SX6Wa726c.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/0E7IMbDzcGABpBwwqNEt60wU0w.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/NTJ0nQgIF0gcDelS14zQ9NR9Q.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/QrcNhgEPfRl0LS8qz5Ln8olanl8.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/JEXmejW8mXOYMtt0hyRg811kHac.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/ksvR4VsLksjpSwnC2fPgHRNMw.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/uy9s0iWuxiNnVt8EpTI3gzohpwo.woff2"); font-display: swap; font-style: italic; font-weight: 500; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/nCpxWS6DaPlPe0lHzStXAPCo3lw.woff2"); font-display: swap; font-style: normal; font-weight: 400; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Display"; src: url("https://framerusercontent.com/assets/djqIk3Er2JcAcz7Rup88BdINEw.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/CfMzU8w2e7tHgF4T4rATMPuWosA.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/867QObYax8ANsfX4TGEVU9YiCM.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116 }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/Oyn2ZbENFdnW7mt2Lzjk1h9Zb9k.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+1F00-1FFF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/cdAe8hgZ1cMyLu9g005pAW3xMo.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0370-03FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/DOfvtmE1UplCq161m6Hj8CSQYg.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/vFzuJY0c65av44uhEKB6vyjFMg.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/tKtBcDnBMevsEEJKdNGhhkLzYo.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/syRNPWzAMIrcJ3wIlPIP43KjQs.woff2"); font-display: swap; font-style: normal; font-weight: 700; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/ia3uin3hQWqDrVloC1zEtYHWw.woff2"); font-display: swap; font-style: italic; font-weight: 700; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/pKRFNWFoZl77qYCAIp84lN1h944.woff2"); font-display: swap; font-style: italic; font-weight: 400; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter"; src: url("https://framerusercontent.com/assets/UjlFhCnUjxhNfep4oYBPqnEssyo.woff2"); font-display: swap; font-style: normal; font-weight: 500; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2070, U+2074-207E, U+2080-208E, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD }
    @font-face { font-family: "Inter Tight Placeholder"; src: local("Arial"); ascent-override: 99.65%; descent-override: 24.81%; line-gap-override: 0.00%; size-adjust: 97.21% }
    @font-face { font-family: "Inter Display Placeholder"; src: local("Arial"); ascent-override: 98.56%; descent-override: 24.54%; line-gap-override: 0.00%; size-adjust: 98.29% }
    @font-face { font-family: "Inter Placeholder"; src: local("Arial"); ascent-override: 89.79%; descent-override: 22.36%; line-gap-override: 0.00%; size-adjust: 107.89% }</style>
        <link href="https://fonts.gstatic.com" rel="preconnect" crossorigin>
        <meta name="robots" content="max-image-preview:large"><link rel="canonical" href="https://diligent-design-103669.framer.app/"><meta property="og:url" content="https://diligent-design-103669.framer.app/"><style data-framer-breakpoint-css>@media(min-width: 1200px){.hidden-72rtr7{display:none!important}}@media(min-width: 810px) and (max-width: 1199.98px){.hidden-3erno9{display:none!important}}@media(min-width: 790px) and (max-width: 809.98px){.hidden-wf9edw{display:none!important}}@media(min-width: 760px) and (max-width: 789.98px){.hidden-wo44w4{display:none!important}}@media(min-width: 620px) and (max-width: 759.98px){.hidden-1ieffmn