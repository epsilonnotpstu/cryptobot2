import { useEffect, useRef, useState } from "react";

const initialAssets = [
  {
    name: "Bitcoin",
    symbol: "BTC",
    price: 67234.56,
    change: 2.34,
    iconClass: "btc",
  },
  {
    name: "Ethereum",
    symbol: "ETH",
    price: 3456.78,
    change: 1.87,
    iconClass: "eth",
  },
  {
    name: "Cardano",
    symbol: "ADA",
    price: 0.4567,
    change: -0.23,
    iconClass: "ada",
  },
];

const features = [
  {
    icon: "fa-shield-alt",
    title: "Bank-Level Security",
    description:
      "Multi-layer security with cold storage, 2FA, and insurance coverage for your digital assets.",
  },
  {
    icon: "fa-chart-line",
    title: "Advanced Analytics",
    description:
      "Real-time market data, technical indicators, and AI-powered insights for better trading decisions.",
  },
  {
    icon: "fa-bolt",
    title: "Lightning Fast",
    description:
      "Execute trades in milliseconds with our high-performance trading engine and global infrastructure.",
  },
  {
    icon: "fa-coins",
    title: "300+ Cryptocurrencies",
    description:
      "Trade Bitcoin, Ethereum, and 300+ other cryptocurrencies with competitive fees and deep liquidity.",
  },
  {
    icon: "fa-mobile-alt",
    title: "Mobile Trading",
    description:
      "Trade on the go with our award-winning mobile apps for iOS and Android devices.",
  },
  {
    icon: "fa-headset",
    title: "24/7 Support",
    description:
      "Get help anytime with our dedicated support team and comprehensive knowledge base.",
  },
];

const steps = [
  {
    icon: "fa-user-plus",
    title: "Create Your Account",
    description:
      "Sign up in minutes with just your email. Verify your identity for enhanced security and higher limits.",
  },
  {
    icon: "fa-credit-card",
    title: "Fund Your Wallet",
    description:
      "Deposit funds using bank transfer, credit card, or existing cryptocurrencies. All transactions are secure and instant.",
  },
  {
    icon: "fa-exchange-alt",
    title: "Start Trading",
    description:
      "Buy, sell, and trade cryptocurrencies with advanced tools, real-time charts, and professional features.",
  },
];

const faqs = [
  {
    question: "Is CryptoByte Pro safe and secure?",
    answer:
      "Yes, we employ bank-level security measures including cold storage for 95% of funds, multi-signature wallets, two-factor authentication, and are fully insured against security breaches.",
  },
  {
    question: "What cryptocurrencies can I trade?",
    answer:
      "You can trade over 300 cryptocurrencies including Bitcoin (BTC), Ethereum (ETH), Cardano (ADA), Solana (SOL), and many others with competitive fees.",
  },
  {
    question: "How do I get started?",
    answer:
      "Getting started is easy! Simply sign up for an account, verify your identity, fund your wallet, and you're ready to start trading. The entire process takes less than 10 minutes.",
  },
  {
    question: "What are your trading fees?",
    answer:
      "Our trading fees start at 0.1% for makers and 0.2% for takers, with significant discounts available for high-volume traders and premium members.",
  },
  {
    question: "Do you offer customer support?",
    answer:
      "Yes, we provide 24/7 customer support through live chat, email, and phone. Our dedicated support team is always ready to help you with any questions or issues.",
  },
  {
    question: "Can I use the platform on mobile?",
    answer:
      "Absolutely! We have award-winning mobile apps for both iOS and Android that offer the full trading experience with advanced charts, real-time notifications, and secure transactions.",
  },
];

const footerSections = [
  {
    title: "Products",
    links: ["Spot Trading", "Futures Trading", "Margin Trading", "Staking"],
  },
  {
    title: "Company",
    links: ["About Us", "Careers", "Press", "Legal"],
  },
  {
    title: "Resources",
    links: ["Help Center", "API Documentation", "Trading Guide", "Blog"],
  },
  {
    title: "Support",
    links: ["Contact Us", "Submit a Request", "System Status", "Bug Bounty"],
  },
];

function formatPrice(price, symbol) {
  if (symbol === "ADA") {
    return `$${price.toFixed(4)}`;
  }

  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assets, setAssets] = useState(initialAssets);
  const [activeFaq, setActiveFaq] = useState(0);
  const [stats, setStats] = useState({
    volume: 0,
    users: 0,
    uptime: 0,
  });
  const canvasRef = useRef(null);

  useEffect(() => {
    const sections = document.querySelectorAll("section, .feature-card");
    sections.forEach((section, index) => {
      section.classList.add("fade-in");
      section.style.transitionDelay = `${index * 0.06}s`;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const targets = { volume: 2.4, users: 500, uptime: 99.9 };
    const startedAt = performance.now();
    let frameId = 0;

    const animate = (time) => {
      const progress = Math.min((time - startedAt) / 1800, 1);
      setStats({
        volume: Number((targets.volume * progress).toFixed(1)),
        users: Math.round(targets.users * progress),
        uptime: Number((targets.uptime * progress).toFixed(1)),
      });

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setAssets((current) =>
        current.map((asset) => {
          const changePercent = (Math.random() - 0.5) * 4;
          return {
            ...asset,
            price: asset.price * (1 + changePercent / 100),
            change: Number(changePercent.toFixed(2)),
          };
        }),
      );
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    const points = Array.from({ length: 50 }, (_, index) => ({
      x: (index / 49) * 100,
      y: 50 + Math.sin(index * 0.3) * 20 + Math.random() * 10 - 5,
    }));

    const resizeAndDraw = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;

      context.clearRect(0, 0, width, height);

      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(103, 126, 234, 0.8)");
      gradient.addColorStop(1, "rgba(103, 126, 234, 0.1)");

      context.beginPath();
      context.moveTo(0, height);
      points.forEach((point) => {
        context.lineTo((point.x / 100) * width, (point.y / 100) * height);
      });
      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = gradient;
      context.fill();

      context.beginPath();
      points.forEach((point, index) => {
        const x = (point.x / 100) * width;
        const y = (point.y / 100) * height;
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.strokeStyle = "#667eea";
      context.lineWidth = 2;
      context.stroke();
    };

    resizeAndDraw();
    const chartInterval = window.setInterval(() => {
      points.forEach((point) => {
        point.y += (Math.random() - 0.5) * 3;
        point.y = Math.max(15, Math.min(85, point.y));
      });
      resizeAndDraw();
    }, 2000);

    window.addEventListener("resize", resizeAndDraw);

    return () => {
      window.clearInterval(chartInterval);
      window.removeEventListener("resize", resizeAndDraw);
    };
  }, []);

  return (
    <div>
      <nav className="navbar">
        <div className="container">
          <div className="nav-brand">
            <div className="logo">
              <i className="fas fa-cube" />
              <span>CryptoByte Pro</span>
            </div>
          </div>

          <div className={`nav-links ${mobileMenuOpen ? "active" : ""}`}>
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>
              Features
            </a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>
              How it Works
            </a>
            <a href="#download" onClick={() => setMobileMenuOpen(false)}>
              Download
            </a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)}>
              FAQ
            </a>
          </div>

          <div className="nav-actions">
            <button type="button" className="btn btn-ghost">
              Login
            </button>
            <button type="button" className="btn btn-primary">
              Start Trading
            </button>
          </div>

          <button
            type="button"
            className={`mobile-menu-toggle ${mobileMenuOpen ? "active" : ""}`}
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-background">
          <div className="gradient-orb orb-1" />
          <div className="gradient-orb orb-2" />
          <div className="gradient-orb orb-3" />
        </div>

        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">
                <span className="gradient-text">Advanced Crypto Trading</span>
                <br />
                Made Simple &amp; Secure
              </h1>

              <p className="hero-description">
                Trade cryptocurrencies with institutional-grade tools, real-time analytics, and
                bank-level security. Join thousands of traders who trust our platform.
              </p>

              <div className="hero-actions">
                <button type="button" className="btn btn-primary btn-large">
                  <i className="fas fa-rocket" />
                  Start Trading Now
                </button>
                <button type="button" className="btn btn-ghost btn-large">
                  <i className="fas fa-play" />
                  Watch Demo
                </button>
              </div>

              <div className="hero-stats">
                <div className="stat">
                  <div className="stat-number">${stats.volume.toFixed(1)}B+</div>
                  <div className="stat-label">Trading Volume</div>
                </div>
                <div className="stat">
                  <div className="stat-number">{stats.users}K+</div>
                  <div className="stat-label">Active Users</div>
                </div>
                <div className="stat">
                  <div className="stat-number">{stats.uptime.toFixed(1)}%</div>
                  <div className="stat-label">Uptime</div>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="crypto-card">
                <div className="card-header">
                  <div className="card-title">Live Portfolio</div>
                  <div className="card-balance">$124,567.89</div>
                </div>

                <div className="crypto-list">
                  {assets.map((asset) => (
                    <div className="crypto-item" key={asset.symbol}>
                      <div className={`crypto-icon ${asset.iconClass}`} />
                      <div className="crypto-info">
                        <div className="crypto-name">{asset.name}</div>
                        <div className="crypto-symbol">{asset.symbol}</div>
                      </div>
                      <div className="crypto-price">
                        <div className="price">{formatPrice(asset.price, asset.symbol)}</div>
                        <div className={`change ${asset.change >= 0 ? "positive" : "negative"}`}>
                          {asset.change >= 0 ? "+" : ""}
                          {asset.change.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card-chart">
                  <canvas id="portfolioChart" ref={canvasRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why Choose CryptoByte Pro?</h2>
            <p className="section-description">
              Advanced features designed for both beginners and professional traders
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature) => (
              <div className="feature-card" key={feature.title}>
                <div className="feature-icon">
                  <i className={`fas ${feature.icon}`} />
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">How It Works</h2>
            <p className="section-description">
              Get started with cryptocurrency trading in just 3 simple steps
            </p>
          </div>

          <div className="steps-container">
            {steps.map((step, index) => (
              <div className="step-group" key={step.title}>
                <div className="step">
                  <div className="step-number">{index + 1}</div>
                  <div className="step-content">
                    <div className="step-icon">
                      <i className={`fas ${step.icon}`} />
                    </div>
                    <h3 className="step-title">{step.title}</h3>
                    <p className="step-description">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 ? <div className="step-connector" /> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="download">
        <div className="container">
          <div className="download-content">
            <div className="download-text-block">
              <h2 className="section-title">Trade Anywhere, Anytime</h2>
              <p className="section-description">
                Download our mobile app and desktop application for seamless trading experience
                across all your devices.
              </p>

              <div className="download-buttons">
                <a href="#download" className="download-btn ios">
                  <i className="fab fa-apple" />
                  <div className="download-text">
                    <span className="download-label">Download for</span>
                    <span className="download-platform">iOS</span>
                  </div>
                </a>
                <a href="#download" className="download-btn android">
                  <i className="fab fa-google-play" />
                  <div className="download-text">
                    <span className="download-label">Get it on</span>
                    <span className="download-platform">Google Play</span>
                  </div>
                </a>
                <a href="#download" className="download-btn desktop">
                  <i className="fas fa-desktop" />
                  <div className="download-text">
                    <span className="download-label">Download for</span>
                    <span className="download-platform">Desktop</span>
                  </div>
                </a>
              </div>
            </div>

            <div className="download-visual">
              <div className="phone-mockup">
                <div className="phone-screen">
                  <div className="app-interface">
                    <div className="app-header">
                      <div className="app-title">CryptoByte Pro</div>
                      <div className="app-balance">$45,678.90</div>
                    </div>
                    <div className="app-chart" />
                    <div className="app-actions">
                      <button type="button" className="app-btn buy">
                        Buy
                      </button>
                      <button type="button" className="app-btn sell">
                        Sell
                      </button>
                      <button type="button" className="app-btn swap">
                        Swap
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="faq">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-description">
              Get answers to the most common questions about our platform
            </p>
          </div>

          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div className={`faq-item ${activeFaq === index ? "active" : ""}`} key={faq.question}>
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setActiveFaq(activeFaq === index ? -1 : index)}
                >
                  <span>{faq.question}</span>
                  <i className="fas fa-chevron-down" />
                </button>
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="logo">
                <i className="fas fa-cube" />
                <span>CryptoByte Pro</span>
              </div>
              <p className="footer-description">
                The world&apos;s most trusted cryptocurrency trading platform with advanced security
                and professional tools.
              </p>
              <div className="social-links">
                <a href="#home">
                  <i className="fab fa-twitter" />
                </a>
                <a href="#home">
                  <i className="fab fa-facebook" />
                </a>
                <a href="#home">
                  <i className="fab fa-linkedin" />
                </a>
                <a href="#home">
                  <i className="fab fa-telegram" />
                </a>
              </div>
            </div>

            <div className="footer-links">
              {footerSections.map((section) => (
                <div className="footer-section" key={section.title}>
                  <h4 className="footer-title">{section.title}</h4>
                  {section.links.map((link) => (
                    <a href="#home" key={link}>
                      {link}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="footer-bottom">
            <div className="footer-copyright">
              <p>&copy; 2024 CryptoByte Pro. All rights reserved.</p>
            </div>
            <div className="footer-legal">
              <a href="#home">Privacy Policy</a>
              <a href="#home">Terms of Service</a>
              <a href="#home">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
