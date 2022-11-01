import React from "react";
import { Trans } from "@lingui/macro";
import SEO from "../../components/Common/SEO";

import Footer from "../../components/Footer/Footer";
import { getPageTitle, ARBITRUM, AVALANCHE } from "../../lib/legacy";

import "./Ecosystem.css";

export default function Ecosystem() {
  const sgxPages = [
    {
      title: "SGX Governance",
      link: "https://gov.sgx.io/",
      linkLabel: "gov.sgx.io",
      about: "SGX Governance Page",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "SGX Stats",
      link: "https://stats.sgx.io/",
      linkLabel: "stats.sgx.io",
      about: "SGX Stats Page",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "SGX Proposals",
      link: "https://snapshot.org/#/sgx.eth",
      linkLabel: "snapshot.org",
      about: "SGX Proposals Voting page",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "SGX Announcements",
      link: "https://t.me/SGX_Announcements",
      linkLabel: "t.me",
      about: "SGX Announcements and Updates",
      chainIds: [ARBITRUM, AVALANCHE],
    },
  ];

  const communityProjects = [
    {
      title: "SGX Blueberry Club",
      link: "https://www.blueberry.club/",
      linkLabel: "blueberry.club",
      about: "SGX Blueberry NFTs",
      creatorLabel: "@xm92boi",
      creatorLink: "https://t.me/xm92boi",
      chainIds: [ARBITRUM],
    },
    {
      title: "SGX Leaderboard",
      link: "https://www.sgx.house/",
      linkLabel: "sgx.house",
      about: "Leaderboard for SGX traders",
      creatorLabel: "@Itburnz",
      creatorLink: "https://t.me/Itburnz",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "SGX Positions Bot",
      link: "https://t.me/SGXPositions",
      linkLabel: "t.me",
      about: "Telegram bot for SGX position updates",
      creatorLabel: "@zhongfu",
      creatorLink: "https://t.me/zhongfu",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Blueberry Pulse",
      link: "https://blueberrypulse.substack.com/",
      linkLabel: "substack.com",
      about: "SGX Weekly Updates",
      creatorLabel: "@puroscohiba",
      creatorLink: "https://t.me/puroscohiba",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "DegenClip",
      link: "https://degenclip.com/sgx",
      linkLabel: "degenclip.com",
      about: "Community curated tweet collection",
      creatorLabel: "@ox21l",
      creatorLink: "https://t.me/ox21l",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "SGX Yield Simulator",
      link: "https://sgx.defisims.com/",
      linkLabel: "defisims.com",
      about: "Yield simulator for SGX",
      creatorLabel: "@kyzoeth",
      creatorLink: "https://twitter.com/kyzoeth",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "SGX Returns Calculator",
      link: "https://docs.google.com/spreadsheets/u/4/d/1mQZlztz_NpTg5qQiYIzc_Ls1OTLfMOUtmEQN-WW8jj4/copy",
      linkLabel: "docs.google.com",
      about: "Returns calculator for SGX and SGXLP",
      creatorLabel: "@AStoicTrader1",
      creatorLink: "https://twitter.com/AStoicTrader1",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "SGX Compound Calculator",
      link: "https://docs.google.com/spreadsheets/d/14DiIE1wZkK9-Y5xSx1PzIgmpcj4ccz1YVw5nwzIWLgI/edit#gid=0",
      linkLabel: "docs.google.com",
      about: "Optimal compound interval calculator",
      creatorLabel: "@ChasenKaminsky",
      creatorLink: "https://twitter.com/ChasenKaminsky",
      chainIds: [AVALANCHE],
    },
    {
      title: "SGX Trading Stats",
      link: "https://t.me/SGXTradingStats",
      linkLabel: "t.me",
      about: "Telegram bot for Open Interest on SGX",
      creatorLabel: "@SniperMonke2",
      creatorLink: "https://twitter.com/SniperMonke2",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "SGX Staking Bot",
      link: "https://t.me/SGX_Staking_bot",
      linkLabel: "t.me",
      about: "SGX staking rewards updates and insights",
      creatorLabel: "@SGX_Staking_bot",
      creatorLink: "https://twitter.com/SGX_Staking_bot",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "SGX Staking Calculator",
      link: "https://sgxstaking.com",
      linkLabel: "sgxstaking.com",
      about: "SGX staking calculator",
      creatorLabel: "@n1njawtf",
      creatorLink: "https://t.me/n1njawtf",
      chainIds: [ARBITRUM, AVALANCHE],
    },
  ];

  const dashboardProjects = [
    {
      title: "SGX Referrals Dashboard",
      link: "https://www.sgxreferrals.com/",
      linkLabel: "sgxreferrals.com",
      about: "Dashboard for SGX referral stats",
      creatorLabel: "@kyzoeth",
      creatorLink: "https://twitter.com/kyzoeth",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "SGX Terminal",
      link: "https://sgxterminal.com",
      linkLabel: "sgxterminal.com",
      about: "SGX explorer for stats and traders",
      creatorLabel: "@vipineth",
      creatorLink: "https://t.me/vipineth",
      chainIds: [ARBITRUM],
    },
    {
      title: "SGX Analytics",
      link: "https://sgxstats.com/",
      linkLabel: "sgxstats.com",
      about: "Financial reports and protocol analytics",
      creatorLabel: "@CryptoMessiah",
      creatorLink: "https://t.me/LarpCapital",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "TokenTerminal",
      link: "https://tokenterminal.com/terminal/projects/sgx",
      linkLabel: "tokenterminal.com",
      about: "SGX fundamentals",
      creatorLabel: "@tokenterminal",
      creatorLink: "https://twitter.com/tokenterminal",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "CryptoFees",
      link: "https://cryptofees.info",
      linkLabel: "cryptofees.info",
      about: "Fees generated by SGX",
      creatorLabel: "@CryptoFeesInfo",
      creatorLink: "https://twitter.com/CryptoFeesInfo",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Shogun Dashboard (Dune Arbitrum)",
      link: "https://dune.com/shogun/sgx-analytics-arbitrum",
      linkLabel: "dune.com",
      about: "Protocol analytics",
      creatorLabel: "@JamesCliffyz",
      creatorLink: "https://twitter.com/JamesCliffyz",
      chainIds: [ARBITRUM],
    },
    {
      title: "Shogun Dashboard (Dune Avalanche)",
      link: "https://dune.com/shogun/sgx-analytics-avalanche",
      linkLabel: "dune.com",
      about: "Protocol analytics",
      creatorLabel: "@JamesCliffyz",
      creatorLink: "https://twitter.com/JamesCliffyz",
      chainIds: [AVALANCHE],
    },
    {
      title: "SGX Perpetuals Data",
      link: "https://app.laevitas.ch/altsderivs/SGX/perpetualswaps",
      linkLabel: "laevitas.ch",
      about: "SGX Perpetuals Data",
      creatorLabel: "@laevitas1",
      creatorLink: "https://twitter.com/laevitas1",
      chainIds: [ARBITRUM],
    },
  ];

  const integrations = [
    {
      title: "DeBank",
      link: "debank.com",
      linkLabe: "debank.com",
      about: "DeFi Portfolio Tracker",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/SGX_IO/status/1439711532884152324",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Defi Llama",
      link: "https://defillama.com",
      linkLabel: "defillama.com",
      about: "Decentralized Finance Dashboard",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/SGX_IO/status/1438124768033660938",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Dopex",
      link: "https://dopex.io",
      linkLabel: "dopex.io",
      about: "Decentralized Options Protocol",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/SGX_IO/status/1482445801523716099",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Rook",
      link: "https://www.rook.fi/",
      linkLabel: "rook.fi",
      about: "MEV Optimizer",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/Rook/status/1509613786600116251",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Jones DAO",
      link: "https://jonesdao.io",
      linkLabel: "jonesdao.io",
      about: "Decentralized Options Strategies",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/SGX_IO/status/1482788805635678212",
      chainIds: [ARBITRUM],
    },
    {
      title: "Yield Yak",
      link: "https://yieldyak.com/",
      linkLabel: "yieldyak.com",
      about: "Yield Optimizer on Avalanche",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/SGX_IO/status/1484601407378378754",
      chainIds: [AVALANCHE],
    },
    {
      title: "Vovo Finance",
      link: "https://vovo.finance/",
      linkLabel: "vovo.finance",
      about: "Structured Products",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/VovoFinance/status/1531517177790345217",
      chainIds: [ARBITRUM],
    },
    {
      title: "Stabilize Protocol",
      link: "https://www.stabilize.finance/",
      linkLabel: "stabilize.finance",
      about: "Yield Vaults",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/StabilizePro/status/1532348674986082306",
      chainIds: [ARBITRUM],
    },
    {
      title: "DODO",
      link: "https://dodoex.io/",
      linkLabel: "dodoex.io",
      about: "Decentralized Trading Protocol",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/SGX_IO/status/1438899138549145605",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Open Ocean",
      link: "https://openocean.finance/",
      linkLabel: "openocean.finance",
      about: "DEX Aggregator",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/SGX_IO/status/1495780826016989191",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Paraswap",
      link: "https://www.paraswap.io/",
      linkLabel: "paraswap.io",
      about: "DEX Aggregator",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/paraswap/status/1546869879336222728",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "1inch",
      link: "https://1inch.io/",
      linkLabel: "1inch.io",
      about: "DEX Aggregator",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/SGX_IO/status/1522247451410845696",
      chainIds: [ARBITRUM, AVALANCHE],
    },
    {
      title: "Firebird Finance",
      link: "https://app.firebird.finance/swap",
      linkLabel: "firebird.finance",
      about: "DEX Aggregator",
      announcementLabel: "twitter.com",
      announcementLink: "https://twitter.com/financefirebird/status/1561767094064238595",
      chainIds: [AVALANCHE],
    },
  ];

  const telegramGroups = [
    {
      title: "SGX",
      link: "https://t.me/SGX_IO",
      linkLabel: "t.me",
      about: "Telegram Group",
    },
    {
      title: "SGX (Chinese)",
      link: "https://t.me/sgxch",
      linkLabel: "t.me",
      about: "Telegram Group (Chinese)",
    },
    {
      title: "SGX (Portuguese)",
      link: "https://t.me/SGX_Portuguese",
      linkLabel: "t.me",
      about: "Telegram Group (Portuguese)",
    },
    {
      title: "SGX Trading Chat",
      link: "https://t.me/gambittradingchat",
      linkLabel: "t.me",
      about: "SGX community discussion",
    },
  ];

  return (
    <SEO title={getPageTitle("Ecosystem Projects")}>
      <div className="default-container page-layout">
        <div>
          <div className="section-title-block">
            <div className="section-title-icon"></div>
            <div className="section-title-content">
              <div className="Page-title">
                <Trans>SGX Pages</Trans>
              </div>
              <div className="Page-title-divider"></div>
              <div className="Page-description">
                <Trans>SGX ecosystem pages.</Trans>
              </div>
            </div>
          </div>
          <div className="DashboardV2-projects">
            {sgxPages.map((item) => {
              const linkLabel = item.linkLabel ? item.linkLabel : item.link;
              return (
                <div className="App-card" key={item.title}>
                  <div className="App-card-title">
                    {item.title}
                  </div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>Link</Trans>
                      </div>
                      <div>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {linkLabel}
                        </a>
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>About</Trans>
                      </div>
                      <div>{item.about}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="Tab-title-section">
            <div className="Page-title">
              <Trans>Community Projects</Trans>
            </div>
            <div className="Page-title-divider"></div>
            <div className="Page-description">
              <Trans>Projects developed by the SGX community.</Trans>
            </div>
          </div>
          <div className="DashboardV2-projects">
            {communityProjects.map((item) => {
              const linkLabel = item.linkLabel ? item.linkLabel : item.link;
              return (
                <div className="App-card" key={item.title}>
                  <div className="App-card-title">
                    {item.title}
                  </div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>Link</Trans>
                      </div>
                      <div>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {linkLabel}
                        </a>
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>About</Trans>
                      </div>
                      <div>{item.about}</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>Creator</Trans>
                      </div>
                      <div>
                        <a href={item.creatorLink} target="_blank" rel="noopener noreferrer">
                          {item.creatorLabel}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="Tab-title-section">
            <div className="Page-title">
              <Trans>Dashboards</Trans>
            </div>
            <div className="Page-title-divider"></div>
            <div className="Page-description">
              <Trans>SGX dashboards and analytics.</Trans>
            </div>
          </div>
          <div className="DashboardV2-projects">
            {dashboardProjects.map((item) => {
              const linkLabel = item.linkLabel ? item.linkLabel : item.link;
              return (
                <div className="App-card" key={item.title}>
                  <div className="App-card-title">
                    {item.title}
                  </div>

                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>Link</Trans>
                      </div>
                      <div>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {linkLabel}
                        </a>
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>About</Trans>
                      </div>
                      <div>{item.about}</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>Creator</Trans>
                      </div>
                      <div>
                        <a href={item.creatorLink} target="_blank" rel="noopener noreferrer">
                          {item.creatorLabel}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="Tab-title-section">
            <div className="Page-title">
              <Trans>Partnerships and Integrations</Trans>
            </div>
            <div className="Page-title-divider"></div>
            <div className="Page-description">
              <Trans>Projects integrated with SGX.</Trans>
            </div>
          </div>
          <div className="DashboardV2-projects">
            {integrations.map((item) => {
              const linkLabel = item.linkLabel ? item.linkLabel : item.link;
              return (
                <div key={item.title} className="App-card">
                  <div className="App-card-title">
                    {item.title}
                  </div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>Link</Trans>
                      </div>
                      <div>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {linkLabel}
                        </a>
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>About</Trans>
                      </div>
                      <div>{item.about}</div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>Announcement</Trans>
                      </div>
                      <div>
                        <a href={item.announcementLink} target="_blank" rel="noopener noreferrer">
                          {item.announcementLabel}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="Tab-title-section">
            <div className="Page-title">
              <Trans>Telegram Groups</Trans>
            </div>
            <div className="Page-title-divider"></div>
            <div className="Page-description">
              <Trans>Community-led Telegram groups.</Trans>
            </div>
          </div>
          <div className="DashboardV2-projects">
            {telegramGroups.map((item) => {
              const linkLabel = item.linkLabel ? item.linkLabel : item.link;
              return (
                <div className="App-card" key={item.title}>
                  <div className="App-card-title">{item.title}</div>
                  <div className="App-card-divider"></div>
                  <div className="App-card-content">
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>Link</Trans>
                      </div>
                      <div>
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {linkLabel}
                        </a>
                      </div>
                    </div>
                    <div className="App-card-row">
                      <div className="label">
                        <Trans>About</Trans>
                      </div>
                      <div>{item.about}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Footer />
      </div>
    </SEO>
  );
}
