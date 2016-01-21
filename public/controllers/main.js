angular.module('MyApp')
  .controller('MainCtrl', ['$scope', 'Show', '$rootScope', function($scope, Show, $rootScope) {

    
    $scope.alphabet = ['0-9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
      'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
      'Y', 'Z'];

    $scope.genres = ['Action', 'Adventure', 'Animation', 'Children', 'Comedy',
      'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'Food',
      'Home and Garden', 'Horror', 'Mini-Series', 'Mystery', 'News', 'Reality',
      'Romance', 'Sci-Fi', 'Sport', 'Suspense', 'Talk Show', 'Thriller',
      'Travel'];

    $scope.headingTitle = 'Top 12 Shows';
    $scope.loading = false;

    $scope.changeLoaderStatus = function() {
      $scope.loading = !$scope.loading;
    };

    $scope.getFirstTwelveShows = function() {
      $scope.changeLoaderStatus();
      Show.query(function(resp) {
        $scope.shows = resp;
        $scope.changeLoaderStatus();
      });
    };

    $scope.getFirstTwelveShows();
    $rootScope.$on('getFirstTwelveShows', function(event, args) {
      $scope.headingTitle = 'Top 12 Shows';
      $scope.getFirstTwelveShows();
    });

    $scope.filterByGenre = function(genre) {
      $scope.changeLoaderStatus();
      Show.query({ genre: genre }, function(resp) {
        $scope.shows = resp;
        $scope.changeLoaderStatus();
      });
      $scope.headingTitle = genre;
    };

    $scope.filterByAlphabet = function(char) {
      $scope.changeLoaderStatus();
      $scope.shows = Show.query({ alphabet: char }, function(resp) {
        $scope.shows = resp;
        $scope.changeLoaderStatus();
      });
      $scope.headingTitle = char;
    };
  }]);