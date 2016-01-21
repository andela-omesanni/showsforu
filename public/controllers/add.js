angular.module('MyApp')
  .controller('AddCtrl', ['$scope', '$alert', 'Show', '$http', function($scope, $alert, Show, $http) {
    $scope.addShow = function(seriesid, index) {
      $scope.adding = 'adding ...';
      Show.save({ id: seriesid }, function() {
        $scope.showName = '';
        $scope.searchForm.$setPristine();
        $scope.adding = null;
        $alert({
          content: 'TV show has been added.',
          placement: 'top-right',
          type: 'success',
          duration: 3
        });
      }, function(response) {
        $scope.showName = ''; 
        $scope.adding = null;
        $scope.searchForm.$setPristine();
        $alert({
          content: response.data.message,
          placement: 'top-right',
          type: 'danger',
          duration: 3
        });
      });
    };

    var getErrMessage = function(err) {
      var message = 'Error occurred';
      if(err.message) {
        message = err.message.replace('undefined', 'Show');
        $scope.shows = [];
      }
      return message;
    };

    $scope.searchForShow = function() {
      $scope.searching = 'Searching ...';
      $http.get('/search/' + $scope.showName).success(function(resp) { 
        if(resp.constructor !== Array) {
          $scope.shows = [];
          $scope.shows.push(resp);
        } else {
          $scope.shows = resp;
        } 
        $scope.searching = null;
      }).error(function(err) { console.log(err);
        $scope.searching = null; 
        $alert({
          content: getErrMessage(err),
          placement: 'top-right',
          type: 'danger',
          duration: 3
        });
      });
    };
  }]);