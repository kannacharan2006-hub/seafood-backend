# Seafood ERP Backend

<p align="center">
  <b>An enterprise-grade Node.js & Express backend designed to power high-throughput seafood distribution, inventory workflows, and subscription-based SaaS management.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18.x-green?style=flat-square&logo=nodedotjs" alt="Node Version">
  <img src="https://img.shields.io/badge/express-framework-blue?style=flat-square&logo=express" alt="Express">
  <img src="https://img.shields.io/badge/security-helmet.js-orange?style=flat-square" alt="Security">
  <img src="https://img.shields.io/badge/payments-razorpay-blueviolet?style=flat-square&logo=razorpay" alt="Razorpay">
  <img src="https://img.shields.io/badge/tests-jest-red?style=flat-square&logo=jest" alt="Jest">
  <img src="https://img.shields.io/badge/license-MIT-purple?style=flat-square" alt="License">
</p>

---

## 🏗️ Architectural Overview

The application follows a clean, modular architectural pattern separating routing logic, controllers, database configurations, and external integrations (such as payment gateways and transactional email services).

```text
seafood-backend/
├── __mocks__/          # Service and database mocks for test isolation
├── config/             # Environment, database, and client configurations
├── docs/               # API specs & Swagger UI documentation assets
├── middleware/         # Security headers, custom authentication & RBAC
├── migrations/         # Database schema evolution scripts
├── routes/             # Express API router endpoints
├── services/           # Core business logic workflows & vendor integrations
├── tests/              # Unit & integration testing suites (Jest)
├── utils/              # Helper utilities, cryptographic functions, and loggers
├── server.js           # Application entry point & cluster manager
└── jest.config.js      # Testing environment configurations
