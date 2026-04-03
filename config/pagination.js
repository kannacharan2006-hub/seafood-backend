class PaginationHelper {
  static defaultPage = 1;
  static defaultLimit = 20;
  static maxLimit = 100;

  static paginate({ page, limit, totalItems }) {
    const totalPages = Math.ceil(totalItems / limit);
    
    return {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  static getOffset(page, limit) {
    return (page - 1) * limit;
  }

  static getLimit(limit) {
    if (limit == null || limit <= 0) return this.defaultLimit;
    if (limit > this.maxLimit) return this.maxLimit;
    return limit;
  }

  static getPage(page) {
    if (page == null || page <= 0) return this.defaultPage;
    return page;
  }
}
