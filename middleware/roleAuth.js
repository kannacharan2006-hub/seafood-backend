const ROLES = {
  OWNER: 'OWNER',
  EMPLOYEE: 'EMPLOYEE'
};

const PERMISSIONS = {
  // Employees CAN access
  purchases: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  exports: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  stock: ['VIEW', 'EDIT'],
  conversions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  vendors: ['VIEW'],
  customers: ['VIEW'],
  items: ['VIEW'],
  categories: ['VIEW'],
  variants: ['VIEW'],
  dashboard: ['VIEW'],
  reports: ['VIEW'],
  
  // Employees CANNOT access
  users: ['VIEW'],  // Can view but not create/edit/delete
  payments: [],
  profits: [],
  employeeManagement: []
};

const roleMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role;

    // Allow if user has required role
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Deny access
    return res.status(403).json({
      success: false,
      message: `Access denied. This feature is only available for: ${allowedRoles.join(', ')}`
    });
  };
};

const checkPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role;

    // Owners have full access
    if (userRole === ROLES.OWNER) {
      return next();
    }

    // Check employee permissions
    const permissions = PERMISSIONS[resource] || [];
    
    if (!permissions.includes(action)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You don't have permission to ${action} ${resource}`
      });
    }

    next();
  };
};

module.exports = {
  ROLES,
  roleMiddleware,
  checkPermission
};