angular.module('MyApp')
  .controller('SubscriptionsCtrl', ['$location', '$cookieStore', 'User', '$rootScope', '$scope', '$alert', '$http', function($location, $cookieStore, User, $rootScope, $scope, $alert, $http) {
    //($rootScope.currentUser = $cookieStore.get('user');
    $scope.fetching = true;
    if(!$rootScope.currentUser) { 
      $location.path('/');
    } else {
      User.get({id: $rootScope.currentUser._id}, function(resp) {
        $rootScope.currentUser = resp;
        $scope.fetching = false; 
      }, function(err) {

      });
    }
  }]);