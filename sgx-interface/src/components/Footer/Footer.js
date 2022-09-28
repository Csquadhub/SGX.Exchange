import React from "react";
import cx from "classnames";
import "./Footer.css";
import logoImg from "../../img/sgx-logo.svg";
import twitterIcon from "../../img/ic_twitter.svg";
import facebookIcon from "../../img/ic_facebook.svg";
import telegramIcon from "../../img/ic_telegram.svg";
import instagramIcon from "../../img/ic_instagram.svg";
import { isHomeSite } from "../../lib/legacy";

const socialLinks = [
  { link: "https://twitter.com/SGX_IO", name: "Twitter", icon: twitterIcon },
  { link: "https://facebook.com/", name: "Facebook", icon: facebookIcon },
  { link: "https://t.me/SGX_IO", name: "Telegram", icon: telegramIcon },
  { link: "https://instagram.com/", name: "Instagram", icon: instagramIcon },
];

export default function Footer({ showRedirectModal, redirectPopupTimestamp }) {
  const isHome = isHomeSite();

  return (
    <div className="Footer">
      <div className={cx("Footer-wrapper", { home: isHome })}>
        <div className="Footer-logo">
          <img src={logoImg} alt="MetaMask" />
        </div>
        <div className="Footer-social-link-block">
          {socialLinks.map((platform) => {
            return (
              <a
                key={platform.name}
                className="App-social-link"
                href={platform.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={platform.icon} alt={platform.name} />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
