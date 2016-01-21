angular.module('MyApp')
  .directive('hideContainer', function() {
    return {
      restrict: 'EA',
      controller: function() { 
        $('.zoomContainer').hide();
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open');
      }
    };
  });