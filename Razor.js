/*global window */
/*jshint curly: false, evil: true */
var Razor = (function(){
  function parse(template){    
    var level = arguments[1] || 0, _mode = arguments[2] || 0, 
      cmds = level >0 ? [] : ['var writer = []; \r\nfunction write(txt){ writer.push(txt); }\r\nwith(this){'],
      cmd =  _mode === 0 ? '"' : '',
      c, c0, np = 0, modes = [_mode];
    
    function mode(m){
      if(m === -1) {
        modes.shift();        
        if(modes[0]===1) modes.shift();
      }
      else modes.unshift(m);
      if(modes.length === 0) modes.unshift(_mode);
    }
    
    function push(){
      if(cmd && cmd !== '""' && cmd !== '"') {
        if(modes[0] >= 6) cmds.push(cmd);
        else cmds.push('\twrite(' + cmd + ');');      
      }
      cmd = '';      
    }
    
    for(var i = 0, ii = template.length; i<ii; i++){
      c0 = c; 
      c = template[i];
      
      if(modes[0] === 0){
        if(c === '@') {
          cmd += '"';
          c = '';
          push();          
          mode(1);
          
        } else if(c === '"') c = '\\"';
        
      } else if(modes[0] === 1){
          if(c === '@'){
            mode(-1);
            cmd = _mode === 0 ? '"' : '';
            
          } else if(c === '*' && cmd.length === 0) {  
            mode(5);
            c = '';
            
          } else if (c === '('){
            if(cmd === ''){
              modes[0] = 2;
              np = 1;
              c = '';
              
            } else if(cmd === 'if' || cmd === 'while') {
              mode(6);
              
            } else {
              mode(2);
              np = 1;
            }
            
          } else if (!/[\w\[\]\(\).]/.test(c)){
            push();
            cmd = _mode === 0 ? '"' : '';
            mode(-1);
          }
          
      } else if (modes[0] === 2){
         if(c === '(') np++;
         else if(c===')') np--;
         if(np === 0){
           if(modes[1] === 1) cmd += ')';
           push();
           c = '';
           mode(-1); 
           cmd = _mode === 0 ? '"' : '';
         }          
          
      } else if (modes[0] === 3){
        if(c === '"' && c0 !== '\\') { 
          mode(-1);
          cmd += c;
          c = '';
        }
        
      } else if (modes[0] === 4){
        if(c === "'" && c0 !== '\\') {
          mode(-1);
          cmd += c;
          c = '';
        }
        
      } else if (modes[0] === 5){
          if(c0 === '*' && c === "@") {
            mode(-1); 
            cmd = '"';
            c = '';
          }
        
      } else if (modes[0] === 6){
        var inblock = np > 0;
        if(c==='{') np++;
        else if(c==='}') np--;
        
        if(inblock && np=== 0){
          var start = cmd.indexOf('{') + 1;
          cmd = cmd.substr(0, start) +
            parse(cmd.substr(start), level + 1, 7) +
            '}';
          push();
          mode(-1);
          c = '';
          cmd = _mode === 0 ? '"' : '';
        }
        
      } if(modes[0] === 7){
        if(c==='<' || c==='@') {
          push();
          if(c==='@'){
            c = '';
            mode(1);
          } else {
            mode(0);
          }
        }          
      }   
      
      if(c === '"') { mode(3); }
      if(c === "'") { mode(4); }        
      cmd += c;       
    } 
  
    cmd += (modes[0]===0?'"':'');
    push(); 
  
    return cmds.join('\r\n') + (level > 0 ? '' : '\r\n}\r\n\treturn writer.join("");');
  }
  
  function extend(a) {
    for (var i = 1, ii = arguments.length; i < ii; i++) {
      var b = arguments[i];
      if (b)
        for (var key in b)
          if (b.hasOwnProperty(key))
            a[key] = b[key];
    }
    return a;
  }
  
  function compile(code, page) {
    var func = new Function(parse(code));
    return function(model, page1){ 
      var ctx = extend({}, page, page1, { model: model });
      return func.apply(ctx);
    };
  }
  
  return { compile: compile, parse: parse, render: function(markup, model, page){ return compile(markup, page)(model); } };
})();