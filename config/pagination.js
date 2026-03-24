class PaginationHelper {
  static const int defaultPage = 1;
  static const int defaultLimit = 20;
  static const int maxLimit = 100;

  static Map<String, dynamic> paginate({
    required int page,
    required int limit,
    required int totalItems,
  }) {
    final totalPages = (totalItems / limit).ceil();
    
    return {
      'currentPage': page,
      'totalPages': totalPages,
      'totalItems': totalItems,
      'itemsPerPage': limit,
      'hasNextPage': page < totalPages,
      'hasPrevPage': page > 1,
    };
  }

  static int getOffset(int page, int limit) {
    return (page - 1) * limit;
  }

  static int getLimit(int? limit) {
    if (limit == null || limit <= 0) return defaultLimit;
    if (limit > maxLimit) return maxLimit;
    return limit;
  }

  static int getPage(int? page) {
    if (page == null || page <= 0) return defaultPage;
    return page;
  }
}
