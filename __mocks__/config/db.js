const createMockPool = () => {
  const mockQuery = jest.fn((query, params, callback) => {
    if (callback) {
      callback(null, []);
    }
    return { promise: () => createMockPool() };
  });

  return {
    query: mockQuery,
    promise: () => ({
      query: jest.fn().mockResolvedValue([[]]),
      getConnection: jest.fn().mockResolvedValue({
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
        query: jest.fn().mockResolvedValue([[]])
      })
    }),
    getConnection: jest.fn().mockResolvedValue({
      beginTransaction: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([[]])
    })
  };
};

module.exports = createMockPool();
