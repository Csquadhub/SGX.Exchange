import React from "react";
import { Trans } from "@lingui/macro";
import Footer from "../../components/Footer/Footer";
import "./Buy.css";
import TokenCard from "../../components/TokenCard/TokenCard";
import buySGXIcon from "../../img/buy_gmx.svg";
import SEO from "../../components/Common/SEO";
import { getPageTitle } from "../../lib/legacy";

export default function BuySGXSGXLP() {
  return (
    <SEO title={getPageTitle("Buy SGXLP or SGX")}>
      <div className="BuySGXSGXLP page-layout">
        <div className="BuySGXSGXLP-container default-container">
          <div className="section-title-block">
            <div className="section-title-icon">
              <img src={buySGXIcon} alt="buySGXIcon" />
            </div>
            <div className="section-title-content">
              <div className="Page-title">
                <Trans>Buy SGX or SSGXLP</Trans>
              </div>
            </div>
          </div>
          <TokenCard />
        </div>
        <Footer />
      </div>
    </SEO>
  );
}
