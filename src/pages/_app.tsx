import { AppProps } from "next/app";

import "tailwindcss/tailwind.css";
import "../styles/app.css";

import { WishlistProvider } from "../context/wishlist";
import Layout from "../components/Layout";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WishlistProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </WishlistProvider>
  );
}

export default MyApp;
