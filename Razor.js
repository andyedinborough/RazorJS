/*global window */
/*jshint curly: false, evil: true */
var Razor = (function(){
  function parse(template){    
    var level = arguments[1] || 0, _mode = arguments[2] || 0, 
      mode = _mode || 0,
      cmds = level >0 ? [] : ['var writer = []; \r\nfunction write(txt){ writer.push(txt); }\r\nwith(this){'],
      cmd =  mode === 0 ? '"' : '',
      c, c0, np = 0, mode0;
    
    function push(cmd){
        if(!cmd || cmd==='""') return;
        if(mode>=6) cmds.push(cmd);
        else cmds.push('\twrite(' + cmd + ');');
    }
    
    for(var i = 0, ii = template.length; i<ii; i++){
      c0 = c;
      c = template[i];
      if (mode === 5){
          if(c === "@" && c0 === '*') {
            mode = mode0;
          }
        
      } else if(mode === 0){
        if(c==='@') {
          mode0 = mode; mode = 1;
          push(cmd + '"');
          cmd = '';     
          
        } else {
          if(c==='"') c = '\\"';
          cmd += c;
        }
        
      } else if(mode > 0){
        if (mode === 3){
          if(c === '"' && c0 !== '\\') { 
            mode = mode0;
            cmd += c;
            c = '';
          }
        } else if (mode === 4){
          if(c === "'" && c0 !== '\\') {
            mode = mode0;
            cmd += c;
            c = '';
          }
          
        } else if (mode === 6){
          var inblock = np>0;
          if(c==='{') np++;
          else if(c==='}') np--;
          
          if(inblock && np=== 0){
            var start = cmd.indexOf('{') + 1;
            push(cmd.substr(0, start));
            push(parse(cmd.substr(start), level + 1, 7));
            push('}');
            mode = mode0;
            c = cmd = '';
          }
          
        } if(mode === 7){
          if(c==='<' || c==='@') {
            push(cmd);
            mode0 = 7; mode = 0;
            cmd = '';
            if(c==='@'){
              c = '';
              mode0 = mode; mode = 1;
            }          
          }
          
        } else {
          if(mode === 1){
            if(c === '@'){
              mode0 = mode; mode = _mode;
              cmd = _mode===0?'"':'';
            } else if(c === '*' && cmd.length === 0) {  
              mode0 = mode; mode = 5;
              c = '';
              
            } else if (c === '('){
              if(cmd === ''){
                mode0 = mode; mode = 2;
                c = '';
                np = 1;
                
              } else if(cmd === 'if' || cmd === 'while') {
                mode0 = mode; mode = 6;
              }
              
            } else if (!/[\w\[\]\(\).]/.test(c)){
              mode0 = mode; mode = _mode;
              if(_mode===7) cmd = 'write('+cmd+ ')';
              push(cmd);
              cmd = _mode===0?'"':'';            
            }
            
          } else if (mode === 2){
             if(c === '(') np++;
             else if(c===')') np--;
             if(np === 0){
               mode0 = mode; mode = _mode;
               c = '';
               push(cmd);
               cmd = _mode===0?'"':'';
             }          
          }
          
          if(c === '"') { mode0 = mode; mode = 3; }
          if(c === "'") {  mode0 = mode; mode = 4; }
        }
        
        cmd += c;  
      }
    } 
  
    mode = _mode;
    cmd += (mode===0?'"':''); 
    push(cmd); 
  
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