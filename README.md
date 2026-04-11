# 🩺 MedTech — Telemedicine Kiosk Platform

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

**Live Platform:**  
🌐 https://medtech-4rjc.onrender.com

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

## 👨‍💻 Author

**Pradeep** - Lead Developer  
📧 Email: pawasthi063@gmail.com  
GitHub: [@Pradeep-gif-hub](https://github.com/Pradeep-gif-hub)

---

## 📞 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/Pradeep-gif-hub/MedTech/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Pradeep-gif-hub/MedTech/discussions)
- **Email**: pawasthi063@gmail.com

---

## ⭐ Show Your Support

If you find this project helpful or interesting, please consider **giving the repository a star ⭐ on GitHub**. It helps increase visibility and motivates further development.

---

**Built with ❤️ for better healthcare accessibility**
# 🩺 MedTech — Telemedicine Kiosk Platform

MedTech is an innovative **telemedicine kiosk platform** designed to bridge the gap between patients and healthcare providers by enabling remote medical consultations through smart digital kiosks. The platform is built to deliver accessible, scalable, and technology-driven healthcare services, particularly in regions where medical infrastructure and specialist availability are limited. By integrating secure authentication, digital health records, consultation management, and prescription tracking into a unified system, MedTech simplifies how patients access healthcare services in the digital age.

The system provides **role-based dashboards** tailored for different stakeholders within the healthcare ecosystem, including patients, doctors, pharmacies, and administrators. Patients can create and manage their digital health profiles, request consultations, and access prescriptions online. Doctors can view patient records, analyze symptoms, and provide diagnoses remotely through an organized interface. Pharmacies and administrators benefit from structured dashboards that allow them to manage prescriptions, oversee system activity, and maintain operational workflows efficiently. This architecture ensures that each role interacts with the system through an optimized interface designed specifically for their responsibilities.

A primary objective of MedTech is to improve healthcare accessibility in **rural and underserved communities** where physical access to hospitals and specialists may be limited. Telemedicine kiosks deployed in clinics, pharmacies, or public health centers allow patients to connect with healthcare professionals quickly and efficiently through a digital interface. By reducing travel time, hospital congestion, and waiting periods, the platform promotes a more efficient healthcare delivery model. Built using a modern full-stack architecture with scalable cloud deployment, MedTech is designed to support future expansion and integration with emerging healthcare technologies.

The platform is powered by **React (Vite + TypeScript)** on the frontend and **FastAPI** on the backend, ensuring high performance, modular architecture, and maintainability. With secure authentication, scalable APIs, and cloud deployment, MedTech aims to create a **sustainable digital healthcare ecosystem** where technology empowers communities with faster, safer, and more reliable medical services.

🌐 **Live Platform:**  
https://medtech-4rjc.onrender.com

---

## ⭐ Support the Project

If you find this project helpful or interesting, please consider **giving the repository a star ⭐ on GitHub**. It helps increase visibility and motivates further development of the platform.

---

## 🤝 Contributing

Contributions are welcome and appreciated. If you would like to improve MedTech or add new features:

1. Fork the repository  
2. Create a new branch for your feature  
3. Make your changes and commit them  
4. Push the branch to your fork  
5. Open a Pull Request describing your improvements  

Example workflow:

```bash
git clone https://github.com/yourusername/medtech.git
cd medtech
git checkout -b feature-new-feature
git commit -m "Add new feature"
git push origin feature-new-feature
