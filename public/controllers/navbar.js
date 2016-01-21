angular.module('MyApp')
  .controller('NavbarCtrl', ['$timeout', '$scope', 'Auth', '$rootScope', function($timeout, $scope, Auth, $rootScope) {
    
    $rootScope.$watch('currentUser', function(user) {
      $timeout(function() {
        $rootScope.currentUser = user; 
      });
    });
    $scope.logout = function() {
      Auth.logout();
    };
    
    $scope.getShows = function() { 
      $rootScope.$emit('getFirstTwelveShows', 'change'); 
    };
  }]);