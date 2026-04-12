<p align="center">
  <h1 align="center"> < MedTech /></h1>
  <p align="center">
    <b>Telemedicine Kiosk Platform</b><br/>
    Bridging patients and healthcare through smart digital consultation
  </p>

  <p align="center">
    <a href="https://medtech-4rjc.onrender.com">
      <img src="https://img.shields.io/badge/🚀%20Live%20Platform-Visit%20Now-blue?style=for-the-badge&logo=vercel&logoColor=white"/>
    </a>
  </p>
</p>

MedTech is an innovative **telemedicine kiosk platform** designed to bridge the gap between patients and healthcare providers by enabling remote medical consultations through smart digital kiosks. The platform is built to deliver accessible, scalable, and technology-driven healthcare services, particularly in regions where medical infrastructure and specialist availability are limited.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## 🎯 Overview

By integrating secure authentication, digital health records, consultation management, and prescription tracking into a unified system, MedTech simplifies how patients access healthcare services in the digital age.


### Mission

To improve healthcare accessibility in **rural and underserved communities** where physical access to hospitals and specialists may be limited. MedTech kiosks deployed in clinics, pharmacies, or public health centers allow patients to connect with healthcare professionals quickly and efficiently through a digital interface.

---

## ✨ Features

### 👥 Role-Based Dashboards
- **Patients**: Create and manage digital health profiles, request consultations, view prescriptions
- **Doctors**: View patient records, analyze symptoms, provide remote diagnoses
- **Pharmacies**: Manage prescriptions and patient medication history
- **Administrators**: Oversee system activity and maintain operational workflows

### 🔐 Core Capabilities
- Secure user authentication with OAuth 2.0 (Google Login)
- Appointment scheduling and consultation management
- Digital health records storage and retrieval
- E-prescriptions and medication tracking
- Real-time notifications and alerts
- Responsive kiosk-optimized interface

### 💡 Benefits
- ⏱️ Reduces travel time and hospital congestion
- 🚀 Faster patient-doctor connections
- 📱 Accessible from smart kiosks in underserved areas
- 🏥 Scalable for healthcare networks

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React with Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Context API / Redux
- **Authentication**: OAuth 2.0 (Google)

### Backend
- **Framework**: FastAPI / Node.js Express
- **Language**: Python / JavaScript
- **Database**: PostgreSQL
- **Email Service**: Brevo SMTP Relay
- **Authentication**: JWT Tokens

### Infrastructure
- **Deployment**: Render.com
- **Version Control**: Git
- **Cloud Storage**: Cloud-based file management

---

## 🏗️ Architecture

```
MedTech/
├── healthconnect-frontend/     # React + TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── utils/
│   └── package.json
│
├── healthconnect-backend/      # FastAPI + Node.js backend
│   ├── src/
│   │   ├── routes/
│   │   ├── models/
│   │   ├── utils/
│   │   └── middleware/
│   ├── main.py
│   └── requirements.txt
│
├── docs/                       # Documentation
├── esp32/                      # IoT components (optional)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- Python 3.9+
- PostgreSQL
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Pradeep-gif-hub/MedTech.git
   cd MedTech
   ```

2. **Fork the repository** (for contributors)
   ```bash
   # Visit: https://github.com/Pradeep-gif-hub/MedTech/fork
   git clone https://github.com/YOUR_USERNAME/MedTech.git
   cd MedTech
   ```

3. **Setup Frontend**
   ```bash
   cd healthconnect-frontend
   npm install
   npm run dev
   ```

4. **Setup Backend**
   ```bash
   cd healthconnect-backend
   pip install -r requirements.txt
   cp .env.example .env
   # Configure your .env file with credentials
   python main.py
   ```

5. **Local Development**
   ```bash
   # See setup-local.sh for complete setup
   bash setup-local.sh
   ```

---

## 📁 Project Structure

- `docs/` - Comprehensive documentation and guides
- `healthconnect-frontend/` - React-based user interface
- `healthconnect-backend/` - API server and business logic
- `esp32/` - IoT sensor integration (optional)
- `package.json` - Root dependencies
- `render.yaml` - Deployment configuration

---

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### How to Contribute

1. **Fork the Repository**
   ```bash
   # Click the "Fork" button on GitHub
   # https://github.com/Pradeep-gif-hub/MedTech/fork
   ```

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/MedTech.git
   cd MedTech
   ```

3. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or for bug fixes:
   git checkout -b bugfix/issue-description
   ```

4. **Make Your Changes**
   - Follow the existing code style and conventions
   - Add tests for new features when applicable
   - Update documentation as needed

5. **Commit Your Changes**
   ```bash
   git commit -m "Add: Brief description of your changes"
   git commit -m "Fix: Brief description of bug fix"
   git commit -m "Docs: Update documentation"
   ```

6. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your fork and branch
   - Provide a clear description of your changes
   - Submit the PR for review

### Contribution Guidelines
- **Code Quality**: Write clean, readable code with meaningful variable names
- **Testing**: Test your changes thoroughly before submitting
- **Documentation**: Update README or docs if adding new features
- **Commit Messages**: Use clear, descriptive commit messages
- **Communication**: Be respectful and constructive in discussions

### Development Setup
```bash
# Install development dependencies
npm install --save-dev
pip install -r requirements-dev.txt

# Run tests
npm test

# Run linter
npm run lint
```

---

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

---

## 👨‍💻 Author

<p align="center">
  <b style="font-size:18px;">Pradeep Awasthi</b><br/>
  <i>Lead Developer — MedTech Platform</i>
</p>

<p align="center">
  <a href="mailto:pawasthi063@gmail.com">
    <img src="https://img.shields.io/badge/📧%20Email-Contact-blue?style=for-the-badge&logo=gmail&logoColor=white"/>
  </a>
  &nbsp;
  <a href="https://github.com/Pradeep-gif-hub">
    <img src="https://img.shields.io/badge/💻%20GitHub-Profile-black?style=for-the-badge&logo=github&logoColor=white"/>
  </a>
</p>

---

## 📞 Contact & Support

<p align="center">
  <a href="https://github.com/Pradeep-gif-hub/MedTech/issues">
    <img src="https://img.shields.io/badge/🐛%20Report-Issues-red?style=for-the-badge&logo=githubissues&logoColor=white"/>
  </a>
  &nbsp;
  <a href="https://github.com/Pradeep-gif-hub/MedTech/discussions">
    <img src="https://img.shields.io/badge/💬%20Discussions-Community-blueviolet?style=for-the-badge&logo=github&logoColor=white"/>
  </a>
  &nbsp;
  <a href="mailto:pawasthi063@gmail.com">
    <img src="https://img.shields.io/badge/📨%20Support-Email-success?style=for-the-badge&logo=gmail&logoColor=white"/>
  </a>
</p>

---
---

## ⭐ Show Your Support

If you find this project helpful or interesting, please consider **giving the repository a star ⭐ on GitHub**. It helps increase visibility and motivates further development.

---

**Built with ❤️ for better healthcare accessibility**
