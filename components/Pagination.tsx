import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

const DOTS = '...';

const range = (start: number, end: number) => {
  let length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
};

const usePagination = ({
  totalCount,
  pageSize,
  siblingCount = 1,
  currentPage
}: { totalCount: number, pageSize: number, siblingCount?: number, currentPage: number }) => {
  const paginationRange = React.useMemo(() => {
    const totalPageCount = Math.ceil(totalCount / pageSize);

    // Pages count is determined as siblingCount + firstPage + lastPage + currentPage + 2*DOTS
    const totalPageNumbers = siblingCount + 5;

    /*
      Case 1:
      If the number of pages is less than the page numbers we want to show in our
      paginationComponent, we return the range [1..totalPageCount]
    */
    if (totalPageNumbers >= totalPageCount) {
      return range(1, totalPageCount);
    }

    /*
    	Calculate left and right sibling index and make sure they are within range 1 and totalPageCount
    */
    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(
      currentPage + siblingCount,
      totalPageCount
    );

    /*
      We do not show dots just when there is just one page number to be inserted between the extremes of sibling and the page limits i.e 1 and totalPageCount. Hence we are using leftSiblingIndex > 2 and rightSiblingIndex < totalPageCount - 2
    */
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPageCount - 2;

    const firstPageIndex = 1;
    const lastPageIndex = totalPageCount;

    /*
    	Case 2: No left dots to show, but rights dots to be shown
    */
    if (!shouldShowLeftDots && shouldShowRightDots) {
      let leftItemCount = 3 + 2 * siblingCount;
      let leftRange = range(1, leftItemCount);

      return [...leftRange, DOTS, totalPageCount];
    }

    /*
    	Case 3: No right dots to show, but left dots to be shown
    */
    if (shouldShowLeftDots && !shouldShowRightDots) {
      let rightItemCount = 3 + 2 * siblingCount;
      let rightRange = range(
        totalPageCount - rightItemCount + 1,
        totalPageCount
      );
      return [firstPageIndex, DOTS, ...rightRange];
    }

    /*
    	Case 4: Both left and right dots to be shown
    */
    if (shouldShowLeftDots && shouldShowRightDots) {
      let middleRange = range(leftSiblingIndex, rightSiblingIndex);
      return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
    }

    return []; // Should not happen with current logic, but keeps TS happy
  }, [totalCount, pageSize, siblingCount, currentPage]);

  return paginationRange;
};


interface PaginationProps {
  onPageChange: (page: number) => void;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  siblingCount?: number;
}

const Pagination: React.FC<PaginationProps> = ({
  onPageChange,
  totalCount,
  currentPage,
  pageSize,
  siblingCount = 1
}) => {
  const totalPageCount = Math.ceil(totalCount / pageSize);
  
  const paginationRange = usePagination({
    currentPage,
    totalCount,
    pageSize,
    siblingCount
  });

  if (currentPage === 0 || totalPageCount < 2) {
    return null;
  }

  const onNext = () => {
    if (currentPage < totalPageCount) {
        onPageChange(currentPage + 1);
    }
  };

  const onPrevious = () => {
    if (currentPage > 1) {
        onPageChange(currentPage - 1);
    }
  };

  return (
    <nav aria-label="Pagination">
      <ul className="flex justify-between sm:justify-center items-center gap-1 w-full">
        <li>
          <button
            onClick={onPrevious}
            disabled={currentPage === 1}
            className="flex items-center justify-center px-3 h-8 rounded-lg transition-colors bg-bunker-200 dark:bg-bunker-800 hover:bg-bunker-300 dark:hover:bg-bunker-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Go to previous page"
          >
            <ChevronLeftIcon />
            <span className="hidden sm:inline ml-1 text-sm font-medium">Anterior</span>
          </button>
        </li>

        {/* Full pagination for sm+ screens */}
        {paginationRange.map((pageNumber, index) => {
          if (pageNumber === DOTS) {
            return <li key={DOTS + index} className="hidden sm:flex px-3 h-8 items-center text-bunker-500">...</li>;
          }

          return (
            <li key={pageNumber} className="hidden sm:block">
              <button
                onClick={() => onPageChange(pageNumber as number)}
                className={`flex items-center justify-center h-8 w-8 text-sm font-medium rounded-lg transition-colors 
                  ${pageNumber === currentPage 
                    ? 'bg-sky-600 text-white shadow' 
                    : 'bg-bunker-200 dark:bg-bunker-800 hover:bg-bunker-300 dark:hover:bg-bunker-700'
                  }`
                }
                aria-current={pageNumber === currentPage ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            </li>
          );
        })}
        
        {/* Simple pagination for xs screens */}
        <li className="flex sm:hidden items-center px-2">
            <span className="text-sm font-medium text-bunker-600 dark:text-bunker-300">
              Página {currentPage} de {totalPageCount}
            </span>
        </li>


        <li>
          <button
            onClick={onNext}
            disabled={currentPage === totalPageCount}
            className="flex items-center justify-center px-3 h-8 rounded-lg transition-colors bg-bunker-200 dark:bg-bunker-800 hover:bg-bunker-300 dark:hover:bg-bunker-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Go to next page"
          >
            <span className="hidden sm:inline mr-1 text-sm font-medium">Próxima</span>
            <ChevronRightIcon />
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;
