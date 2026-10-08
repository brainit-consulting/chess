from playwright.sync_api import sync_playwright
import os
from pathlib import Path
out=Path('audit/ipad');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 for engine in ['webkit','chromium']:
  args={'headless':True}
  if engine=='chromium' and os.environ.get('CHROMIUM_EXECUTABLE'):
   args['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
  b=getattr(p,engine).launch(**args)
  page=b.new_page(viewport={'width':768,'height':1024},device_scale_factor=2,has_touch=True,is_mobile=True)
  errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
  page.goto('http://127.0.0.1:5188');page.wait_for_function('() => window.__game?.scene.modelsReady')
  for w,h in [(768,1024),(1024,768),(1366,1024),(390,844)]:
   page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(600)
   dims=page.evaluate('''() => {const s=__game.scene;const r=document.querySelector('#scene').getBoundingClientRect();const hud=document.querySelector('#hud').getBoundingClientRect(); return {width:r.width,height:r.height,aspect:s.camera.aspect,hudTop:hud.top,boardBottom:r.bottom,draws:s.renderer.info.render.calls,contextLost:s.renderer.getContext().isContextLost()}}''')
   assert abs(dims['aspect']-dims['width']/dims['height'])<.01,dims
   assert dims['boardBottom']<=dims['hudTop']+1 and dims['draws']>0 and not dims['contextLost'],dims
   page.screenshot(path=str(out/f'{engine}-{w}.png'))
   print(engine,w,dims)
  page.set_viewport_size({'width':1024,'height':768});page.wait_for_timeout(500)
  page.get_by_role('button',name='Human vs Human',exact=True).click()
  page.get_by_role('button',name='Top-Down',exact=True).click();page.wait_for_timeout(500)
  def move(file,rank):
   point=page.evaluate('''([file,rank]) => {const s=__game.scene;const v=s.squareToWorld({file,rank});v.y=rank==1?.5:.1;v.project(s.camera);const r=s.renderer.domElement.getBoundingClientRect();return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2}}''',[file,rank])
   page.mouse.click(point['x'],point['y'])
  move(4,1);print('selected',page.evaluate('() => __game.selected'));move(4,3)
  page.wait_for_function("() => __game.state.activeColor === 'b'")
  print(engine,'human move passed')
  page.get_by_role('button',name='AI vs AI',exact=True).click()
  page.get_by_role('button',name='Start Game',exact=True).click()
  page.wait_for_function('() => __game.state.fullmoveNumber >= 2',timeout=30000)
  page.get_by_role('button',name='Pause',exact=True).click()
  print(engine,'AI vs AI passed')
  assert not errors,errors
  b.close()



